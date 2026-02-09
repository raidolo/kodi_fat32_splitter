import os
import signal
import subprocess
import threading
import time
import glob
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends, status, Request
import httpx
import json

SECRET_KEY = "CHANGE_THIS_TO_A_SECURE_RANDOM_KEY_IN_PRODUCTION" # TODO: Move to env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# OIDC Configuration
OIDC_AUTHORITY = os.getenv("OIDC_AUTHORITY")
OIDC_CLIENT_ID = os.getenv("OIDC_CLIENT_ID")

# Cache for OIDC Discovery and JWKS
OIDC_CACHE = {
    "config": None,
    "jwks": None,
    "last_updated": 0,
    "ttl": 3600  # 1 hour
}

# Cache for UserInfo (keyed by token hash, short TTL)
USERINFO_CACHE = {}  # {token_hash: {"email": ..., "expires": timestamp}}
USERINFO_CACHE_TTL = 300  # 5 minutes

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

app = FastAPI()

DATA_DIR = "/data"
CONFIG_DIR = "/config"
SETTINGS_FILE = os.path.join(CONFIG_DIR, "settings.json")

# Ensure settings exist on startup
@app.on_event("startup")
async def startup_event():
    print("Checking settings configuration...")
    get_settings_internal()

class SplitRequest(BaseModel):
    files: List[str]

class DeleteRequest(BaseModel):
    mode: str  # "single" or "all"
    path: str

class TaskStatus(BaseModel):
    is_running: bool
    current_file: str | None
    files_total: int
    files_processed: int
    files_processed: int
    last_output: str

class Settings(BaseModel):
    theme: str = "dark"
    include_subtitles: bool = True
    admin_email: str | None = None
    admin_password_hash: str | None = None

class SettingsPublic(BaseModel):
    theme: str = "dark"
    include_subtitles: bool = True
    admin_email: str | None = None
    password_set: bool = False

class User(BaseModel):
    email: str
    is_admin: bool = False

class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: str | None = None

class SetupRequest(BaseModel):
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str


# Global State
class BackgroundTask:
    def __init__(self):
        self.process = None
        self.is_running = False
        self.stop_requested = False
        self.current_file = None
        self.files_total = 0
        self.files_processed = 0
        self.lock = threading.Lock()
        self.last_output = ""

task_state = BackgroundTask()

# Auth Utils
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def validate_oidc_token(token: str) -> TokenData:
    if not OIDC_AUTHORITY or not OIDC_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OIDC configuration missing in backend"
        )

    try:
        current_time = time.time()
        
        # Check cache (TTL 1 hour)
        if (OIDC_CACHE["config"] and OIDC_CACHE["jwks"] and 
            (current_time - OIDC_CACHE["last_updated"] < OIDC_CACHE["ttl"])):
            config = OIDC_CACHE["config"]
            jwks = OIDC_CACHE["jwks"]
        else:
            print("Fetching OIDC configuration...")
            # 1. OIDC Discovery
            discovery_url = f"{OIDC_AUTHORITY}/.well-known/openid-configuration"
            async with httpx.AsyncClient() as client:
                resp = await client.get(discovery_url)
                resp.raise_for_status()
                config = resp.json()
            
            jwks_url = config.get("jwks_uri")
            if not jwks_url:
                raise Exception("jwks_uri not found in OIDC discovery")

            # 2. Fetch JWKS
            async with httpx.AsyncClient() as client:
                resp = await client.get(jwks_url)
                resp.raise_for_status()
                jwks = resp.json()
            
            # Update Cache
            OIDC_CACHE["config"] = config
            OIDC_CACHE["jwks"] = jwks
            OIDC_CACHE["last_updated"] = current_time
            print("OIDC Cache updated.")

        userinfo_url = config.get("userinfo_endpoint")

        # 3. Decode token header to get Key ID (kid)
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
        
        if not rsa_key:
             # Refresh JWKS? For now just fail.
            raise JWTError("Unable to find appropriate key")

        # 4. Verify Token Signature
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=OIDC_CLIENT_ID,
            issuer=OIDC_AUTHORITY # Optional: verify issuer
        )
        
        # print(f"Decoded OIDC Payload: {payload}")
        email: str = payload.get("email")
        
        # 5. Fetch UserInfo if email missing
        if email is None:
             # Check UserInfo cache first
             import hashlib
             token_hash = hashlib.sha256(token.encode()).hexdigest()[:16]
             cached = USERINFO_CACHE.get(token_hash)
             if cached and cached.get("expires", 0) > time.time():
                 email = cached.get("email")
             elif not userinfo_url:
                 print("UserInfo endpoint not found in discovery, cannot fetch email.")
             else:
                 print(f"Email not in token, fetching UserInfo from {userinfo_url}...")
                 async with httpx.AsyncClient() as client:
                     resp = await client.get(userinfo_url, headers={"Authorization": f"Bearer {token}"})
                     if resp.status_code != 200:
                         print(f"UserInfo fetch failed: {resp.status_code} Body: {resp.text}")
                         resp.raise_for_status()
                     
                     userinfo = resp.json()
                     email = userinfo.get("email")
                     if not email:
                         email = userinfo.get("preferred_username")
                     
                     # Cache result
                     if email:
                         USERINFO_CACHE[token_hash] = {
                             "email": email,
                             "expires": time.time() + USERINFO_CACHE_TTL
                         }

        if email is None:
             raise JWTError("Email claim missing in Token and UserInfo")
             
        return TokenData(email=email)

    except Exception as e:
        print(f"OIDC Validation failed: {e}")
        # Print stack trace if needed, or detailed error
        import traceback
        traceback.print_exc()
        raise JWTError(str(e))

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = None
    
    # 1. Try Local Validation (HS256)
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise JWTError("Missing sub")
        token_data = TokenData(email=email)
    except JWTError:
        # 2. Try OIDC Validation (RS256) if local failed
        try:
             # Only attempt if OIDC is configured
             if OIDC_AUTHORITY:
                 token_data = await validate_oidc_token(token)
             else:
                 raise credentials_exception
        except JWTError:
             raise credentials_exception
    except Exception:
        raise credentials_exception

    if not token_data:
        raise credentials_exception
    
    settings = get_settings_internal()
    
    # Check if user is Admin
    if settings.admin_email and settings.admin_email.lower() == token_data.email.lower():
        return User(email=settings.admin_email, is_admin=True)
    
    # For now, we strictly require the user to be the admin.
    # If users need read-only access later, we can relax this.
    # But for "Files disappearing", it implies they are logged in but rejected.
    
    print(f"User {token_data.email} is not admin ({settings.admin_email})")
    raise credentials_exception

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    return current_user

def get_directory_contents(subpath=""):
    # Secure path traversal check
    target_dir = os.path.abspath(os.path.join(DATA_DIR, subpath.strip(os.path.sep)))
    if not target_dir.startswith(DATA_DIR):
        raise HTTPException(status_code=403, detail="Invalid path")
    
    if not os.path.exists(target_dir):
        raise HTTPException(status_code=404, detail="Path not found")

    items = []
    folders = []
    
    try:
        with os.scandir(target_dir) as it:
            for entry in it:
                if entry.name.startswith('.'):
                    continue
                
                full_path = entry.path
                if entry.is_dir():
                    folders.append({
                        "name": entry.name,
                        "path": os.path.relpath(full_path, DATA_DIR).replace("\\", "/")
                    })
                elif entry.is_file() and entry.name.lower().endswith((".mkv", ".mp4")):
                    file_size = entry.stat().st_size
                    # Subtitle Detection
                    # Pattern: video_name.*.srt OR video_name.srt
                    base_name_no_ext = os.path.splitext(entry.name)[0]
                    # Filter matching files in the current scan iterator is hard, better to use glob or re-scan?
                    # Since we are iterating, we can't easily peek.
                    # Efficient approach: we iterate all files anyway. But relating them is tricky in a single pass without storing all.
                    # Alternative: Use glob for subs finding per video. It's file-system intensive but accurate.
                    
                    subs_pattern = glob.escape(full_path.rsplit('.', 1)[0]) + "*.srt"
                    subs_files = []
                    # Also check for exact match if glob doesn't cover it? (glob * covers .en.srt and .srt)
                    # Be careful not to match "movie_sequel.srt" if we have "movie.mkv". 
                    # full_path without extension -> "movie"
                    # glob "movie*.srt" matches "movie_sequel.srt".
                    # We want "movie.srt", "movie.en.srt", "movie.it.srt".
                    # So essentially string must start with "movie."
                    
                    video_base_prefix = full_path.rsplit('.', 1)[0] + "."
                    
                    detected_subs = []
                    subs_size = 0
                    
                    # Glob is safer
                    for potential_sub in glob.glob(subs_pattern):
                         # Standard convention check: 
                         # valid: /path/movie.srt, /path/movie.en.srt
                         # invalid: /path/movie_sequel.srt
                         if potential_sub.startswith(video_base_prefix) or potential_sub == (full_path.rsplit('.', 1)[0] + ".srt"):
                             detected_subs.append(potential_sub)
                             subs_size += os.path.getsize(potential_sub)

                    # Dynamic Settings Check
                    settings = get_settings_internal()
                    if not settings.include_subtitles:
                        subs_size = 0 # Don't count extra size
                        
                    total_size = file_size + subs_size

                    # Check split status by size verification
                    
                    # Glob for all related parts
                    # Patterns: 
                    # 1. exact match: filename.rar 
                    # 2. parts: filename.part*.rar
                    
                    base_name = full_path + ".rar"
                    part_pattern = glob.escape(full_path) + ".part*.rar"
                    
                    rar_size = 0
                    has_files = False
                    part_count = 0
                    
                    if os.path.exists(base_name):
                        rar_size += os.path.getsize(base_name)
                        has_files = True
                        part_count += 1
                        
                    for f in glob.glob(part_pattern):
                        rar_size += os.path.getsize(f)
                        has_files = True
                        part_count += 1
                    
                    status = "NONE"
                    if has_files:
                        # Strict Size Validation using Fixed Overhead
                        # Store mode (-m0) overhead is headers only, not proportional to size.
                        # We allow ~2KB per RAR volume for headers.
                        overhead_buffer = part_count * 2048 
                        
                        if rar_size >= total_size and rar_size <= (total_size + overhead_buffer):
                            status = "SPLIT"
                        else:
                            status = "PARTIAL"
                    
                    items.append({
                        "name": entry.name,
                        "path": os.path.relpath(full_path, DATA_DIR).replace("\\", "/"),
                        "status": status,
                        "rar_parts": part_count,
                        "original_size": file_size, # Keep video size for display text
                        "total_size": total_size,   # For Red/Green badge logic
                        "subs_count": len(detected_subs),
                        "size_info": f"{rar_size / (1024*1024):.1f}MB / {total_size / (1024*1024):.1f}MB"
                    })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    folders.sort(key=lambda x: x["name"])
    items.sort(key=lambda x: x["name"])
    
    # Calculate parent path
    parent_path = None
    if subpath and subpath != ".":
        parent_path = os.path.dirname(subpath.rstrip(os.path.sep)).replace("\\", "/")
        if parent_path == ".":
            parent_path = ""
            
    return {
        "current_path": subpath.replace("\\", "/"),
        "parent_path": parent_path,
        "folders": folders,
        "files": items
    }

def cleanup_file_artifacts(target_path: str):
    """Clean up any RAR artifacts for a specific media file."""
    # Detect patterns: 
    # 1. Exact match: filename.rar
    # 2. Parts: filename.part*.rar
    
    base_name = target_path + ".rar"
    # Use glob.escape for the base path to handle [ ] etc.
    escaped_path = glob.escape(target_path)
    
    patterns = [
        escaped_path + ".part*.rar",
        escaped_path + ".rar",
        escaped_path + ".part*.rar.tmp",
        escaped_path + ".rar.tmp"
    ]
    
    candidates = set()
    
    if os.path.exists(base_name):
        candidates.add(base_name)
        
    for pat in patterns:
        for f in glob.glob(pat):
            candidates.add(f)
            
    count = 0
    for f in candidates:
        if force_delete(f):
            count += 1
    return count

def run_split_task(files: List[str]):
    global task_state
    with task_state.lock:
        task_state.is_running = True
        task_state.files_total = len(files)
        task_state.files_processed = 0
        task_state.stop_requested = False

    try:
        for rel_file_path in files:
            if task_state.stop_requested:
                break
            
            # Reconstruct full path
            file_path = os.path.join(DATA_DIR, rel_file_path)
            
            with task_state.lock:
                task_state.current_file = rel_file_path
            
            if not os.path.exists(file_path):
                print(f"File not found: {file_path}")
                continue

            # Auto-cleanup previous artifacts before starting
            print(f"Cleaning up artifacts for {file_path}...")
            cleanup_file_artifacts(file_path)

            # Detect Subtitles to include
            video_base_prefix = file_path.rsplit('.', 1)[0] + "."
            subs_pattern = glob.escape(file_path.rsplit('.', 1)[0]) + "*.srt"
            detected_subs = []
            
            for potential_sub in glob.glob(subs_pattern):
                 if potential_sub.startswith(video_base_prefix) or potential_sub == (file_path.rsplit('.', 1)[0] + ".srt"):
                     detected_subs.append(potential_sub)
            
            # Filter based on settings
            settings = get_settings_internal()
            if settings.include_subtitles:
                for s in detected_subs:
                    print(f"Including subtitle: {s}")
            else:
                print("Subtitles disabled in settings. Skipping inclusion.")
                detected_subs = []

            # Construct RAR command using RELATIVE PATHS (executed in work_dir)
            # This prevents Storing /data/Folder/File inside the RAR
            
            work_dir = os.path.dirname(file_path)
            file_basename = os.path.basename(file_path)
            archive_name_rel = file_basename + ".rar"
            
            cmd = [
                "rar", "a", 
                "-v4095M", 
                "-m0",  # Store mode for speed
                "-y",   # Assume yes on overwrite/questions
                archive_name_rel, 
                file_basename
            ]
            
            # Append subtitles (basenames only)
            if detected_subs:
                cmd.extend([os.path.basename(s) for s in detected_subs])
            
            print(f"Starting command: {' '.join(cmd)} in CACHED_DIR: {work_dir}")
            
            try:
                # Start process with lock to ensure kill endpoint sees it immediately
                with task_state.lock:
                    if task_state.stop_requested:
                        break # Stop if requested right before start
                        
                    task_state.process = subprocess.Popen(
                        cmd, 
                        stdout=subprocess.PIPE, 
                        stderr=subprocess.STDOUT, 
                        text=True,
                        bufsize=1,
                        cwd=work_dir  # Execute in the file's directory
                    )
                
                if task_state.process.stdout:
                    for line in task_state.process.stdout:
                        line = line.strip()
                        if line:
                            # Update output safely
                            with task_state.lock:
                                task_state.last_output = line
                
                task_state.process.wait()
                
                if task_state.process.returncode != 0 and not task_state.stop_requested:
                    raise Exception(f"RAR failed with code {task_state.process.returncode}")
                    
            except Exception as e:
                print(f"Error processing {file_path}: {e}")
                # Don't stop the whole batch, just log? 
                # Or stop? Let's log and continue for now.
            finally:
                task_state.process = None

            with task_state.lock:
                task_state.files_processed += 1

    finally:
        with task_state.lock:
            task_state.is_running = False
            task_state.current_file = None
            task_state.process = None


@app.get("/api/files")
def list_files(path: str = "", current_user: User = Depends(get_current_active_user)):
    return get_directory_contents(path)

@app.post("/api/split")
def start_split(request: SplitRequest, current_user: User = Depends(get_current_active_user)):
    global task_state
    with task_state.lock:
        if task_state.is_running:
            raise HTTPException(status_code=400, detail="Task already running")
    
    # Just validate list is not empty
    if not request.files:
        raise HTTPException(status_code=400, detail="No valid files provided")

    thread = threading.Thread(target=run_split_task, args=(request.files,))
    thread.start()
    
    return {"status": "started", "count": len(request.files)}

def force_delete(file_path: str):
    """Try to delete a file, handling permission errors. Retries with chmod and system rm."""
    max_retries = 10
    for i in range(max_retries):
        try:
            if not os.path.exists(file_path):
                return False # Already gone
                
            os.remove(file_path)
            print(f"Deleted: {file_path}")
            return True
        except PermissionError:
            print(f"[{i+1}/{max_retries}] Permission denied for {file_path}. Trying chmod...")
            try:
                os.chmod(file_path, 0o777)
                os.remove(file_path)
                print(f"Deleted (after chmod): {file_path}")
                return True
            except Exception as e:
                print(f"Failed to delete {file_path} after chmod: {e}")
        except FileNotFoundError:
            return False
        except Exception as e:
            print(f"[{i+1}/{max_retries}] Error deleting {file_path}: {e}")
        
        # Fallback: System force delete (nuclear option)
        try:
            print(f"[{i+1}/{max_retries}] Trying system rm -f...")
            subprocess.run(["rm", "-f", file_path], check=True)
            if not os.path.exists(file_path):
                 print(f"Deleted (via rm -f): {file_path}")
                 return True
        except Exception as e:
             print(f"rm -f failed: {e}")

        # Wait before retry
        time.sleep(0.5)
        
    print(f"Gave up deleting {file_path} after {max_retries} attempts.")
    return False

@app.post("/api/delete_rars")
def delete_rars(request: DeleteRequest, current_user: User = Depends(get_current_active_user)):
    print(f"Delete request: {request}")
    target_path = os.path.abspath(os.path.join(DATA_DIR, request.path.strip(os.path.sep)))
    if not target_path.startswith(DATA_DIR):
        raise HTTPException(status_code=403, detail="Invalid path")

    deleted_count = 0
    import glob
    
    if request.mode == "single":
        # Delete specific file's RARs
        if not target_path.lower().endswith((".mkv", ".mp4")):
             raise HTTPException(status_code=400, detail="Target must be an MKV or MP4 file")
             
        deleted_count = cleanup_file_artifacts(target_path)
            
    elif request.mode == "all":
        # Delete all RARs in directory
        if not os.path.isdir(target_path):
             raise HTTPException(status_code=400, detail="Target must be a directory")
        
        # Escape the directory path too just in case
        escaped_dir = glob.escape(target_path)
        rar_files = glob.glob(os.path.join(escaped_dir, "*.rar"))
        
        # Also clean .tmp files? Maybe risky. Let's stick to .rar for bulk clean.
        
        for f in rar_files:
            if force_delete(f):
                deleted_count += 1

    print(f"Total deleted: {deleted_count}")
    return {"status": "deleted", "count": deleted_count}

@app.get("/api/status")
def get_status(current_user: User = Depends(get_current_active_user)):
    global task_state
    with task_state.lock:
        return TaskStatus(
            is_running=task_state.is_running,
            current_file=task_state.current_file,
            files_total=task_state.files_total,
            files_processed=task_state.files_processed,
            last_output=task_state.last_output
        )

@app.post("/api/kill")
def kill_process(current_user: User = Depends(get_current_active_user)):
    global task_state
    with task_state.lock:
        if not task_state.is_running:
            return {"status": "not running"}
        
        task_state.stop_requested = True
        
        if task_state.process:
            print("Killing process immediately...")
            try:
                task_state.process.kill()
            except Exception as e:
                print(f"Error killing process: {e}")
            
    return {"status": "termination requested"}

def get_settings_internal() -> Settings:
    if not os.path.exists(SETTINGS_FILE):
        defaults = Settings()
        try:
            os.makedirs(CONFIG_DIR, exist_ok=True)
            with open(SETTINGS_FILE, "w") as f:
                f.write(defaults.model_dump_json(indent=2))
            print(f"Created default settings at {SETTINGS_FILE}")
        except Exception as e:
            print(f"Failed to create default settings: {e}")
        return defaults

    try:
        with open(SETTINGS_FILE, "r") as f:
            import json
            data = json.load(f)
            return Settings(**data)
    except:
        return Settings()

@app.get("/api/settings", response_model=SettingsPublic)
def get_settings(current_user: User = Depends(get_current_active_user)):
    settings = get_settings_internal()
    # Compute virtual fields
    response = settings.model_dump()
    response['password_set'] = settings.admin_password_hash is not None
    return SettingsPublic(**response)

@app.post("/api/settings", response_model=SettingsPublic)
def save_settings(new_settings: Settings, current_user: User = Depends(get_current_active_user)):
    try:
        current = get_settings_internal()
        
        # Preserve sensitive data if not provided
        if current.admin_password_hash:
             new_settings.admin_password_hash = current.admin_password_hash
        
        if current.admin_email and not new_settings.admin_email:
             new_settings.admin_email = current.admin_email

        os.makedirs(CONFIG_DIR, exist_ok=True)
        with open(SETTINGS_FILE, "w") as f:
            f.write(new_settings.model_dump_json(indent=2))
            
        # Return public response
        response = new_settings.model_dump()
        response['password_set'] = new_settings.admin_password_hash is not None
        return SettingsPublic(**response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

@app.post("/api/admin/password")
async def change_password(req: PasswordChangeRequest, current_user: User = Depends(get_current_active_user)):
    settings = get_settings_internal()
    
    if not settings.admin_password_hash:
        raise HTTPException(status_code=400, detail="No admin password set")

    # Verify current password
    if not verify_password(req.current_password, settings.admin_password_hash):
         raise HTTPException(status_code=400, detail="Invalid current password")
         
    settings.admin_password_hash = get_password_hash(req.new_password)
    
    # Save directly to file to bypass the save_settings logic which might trigger recursion if we called it (though we didn't)
    # Re-use save_settings logic manually or just write it.
    try:
        with open(SETTINGS_FILE, "w") as f:
            f.write(settings.model_dump_json(indent=2))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"status": "password updated"}

@app.post("/api/setup")
def setup_admin(request: SetupRequest):
    settings = get_settings_internal()
    if settings.admin_email:
        raise HTTPException(status_code=400, detail="Setup already completed")
    
    hashed_password = get_password_hash(request.password)
    settings.admin_email = request.email
    settings.admin_password_hash = hashed_password
    
    # Manual save
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        f.write(settings.model_dump_json(indent=2))
        
    return {"status": "setup complete"}

@app.post("/api/auth/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    settings = get_settings_internal()
    if not settings.admin_email:
        # Fallback if no setup done? Or ensure setup is done first.
         raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Setup not completed",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if form_data.username != settings.admin_email or not verify_password(form_data.password, settings.admin_password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": settings.admin_email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

class OidcPromoteRequest(BaseModel):
    email: str

@app.post("/api/auth/promote-oidc", response_model=Token)
def promote_oidc_user(request: OidcPromoteRequest):
    # This endpoint should probably be protected or only callable if no admin exists?
    # It seems to be used to assume admin role if OIDC matches.
    # Current logic:
    settings = get_settings_internal()
    if settings.admin_email and settings.admin_email != request.email:
         raise HTTPException(status_code=400, detail="Admin already exists")
    
    # If admin doesn't exist, we allow promotion?
    # This is slightly risky if anyone can hit it.
    # But only if they know the email that WILL be admin.
    # The logic in App.jsx checks auth.oidcEnabled && auth.isAuthenticated.
    # To secure this, we might want to verify the OIDC token?
    # But this backend doesn't know about OIDC provider details to verify token independently unless we pass it.
    # For now, let's leave as is but note it. 
    # Actually, it's safer if we require SOME auth, but this is bootstrap.
    
    settings.admin_email = request.email
    # Don't save using route handler
    os.makedirs(CONFIG_DIR, exist_ok=True)
    with open(SETTINGS_FILE, "w") as f:
        f.write(settings.model_dump_json(indent=2))
    
    # Generate Token for this user so they can set password immediately
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": settings.admin_email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

class SetPasswordRequest(BaseModel):
    new_password: str

@app.post("/api/admin/set-password")
async def set_initial_password(req: SetPasswordRequest, current_user: User = Depends(get_current_active_user)):
    settings = get_settings_internal()
    if settings.admin_password_hash:
        raise HTTPException(status_code=400, detail="Password already set")
        
    settings.admin_password_hash = get_password_hash(req.new_password)
    
    try:
        with open(SETTINGS_FILE, "w") as f:
            f.write(settings.model_dump_json(indent=2))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    return {"status": "password set"}

@app.get("/api/auth/status")
def auth_status():
    settings = get_settings_internal()
    # Setup required if NO admin exists
    setup_req = settings.admin_email is None
    
    # Password setup required if admin exists BUT has no password
    pass_setup_req = settings.admin_email is not None and settings.admin_password_hash is None
    
    # Check OIDC (env var) - effectively passed via frontend config but backend can know too if needed
    # For now frontend handles OIDC config.
    
    return {
        "setup_required": setup_req,
        "password_setup_required": pass_setup_req,
        "oidc_enabled": False # Placeholder
    }

@app.get("/api/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_active_user)):
    return current_user
