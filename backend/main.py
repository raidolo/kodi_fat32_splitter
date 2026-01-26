import os
import signal
import subprocess
import threading
import time
import glob
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

DATA_DIR = "/data"

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
    last_output: str

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
                elif entry.is_file() and entry.name.lower().endswith(".mkv"):
                    # Check split status by size verification
                    mkv_size = entry.stat().st_size
                    
                    # Glob for all related parts
                    # Patterns: 
                    # 1. exact match: filename.rar 
                    # 2. parts: filename.part*.rar
                    
                    base_name = full_path + ".rar"
                    part_pattern = glob.escape(full_path) + ".part*.rar"
                    
                    rar_size = 0
                    has_files = False
                    
                    if os.path.exists(base_name):
                        rar_size += os.path.getsize(base_name)
                        has_files = True
                        
                    for f in glob.glob(part_pattern):
                        rar_size += os.path.getsize(f)
                        has_files = True
                    
                    status = "NONE"
                    if has_files:
                        # In Store mode (-m0), total RAR size should be >= original size (due to headers)
                        # We allow a small margin of error just in case, but generally strictly less means incomplete.
                        if rar_size >= mkv_size:
                            status = "SPLIT"
                        else:
                            status = "PARTIAL"
                    
                    items.append({
                        "name": entry.name,
                        "path": os.path.relpath(full_path, DATA_DIR).replace("\\", "/"),
                        "status": status,
                        "size_info": f"{rar_size / (1024*1024):.1f}MB / {mkv_size / (1024*1024):.1f}MB"
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
    """Clean up any RAR artifacts for a specific MKV file."""
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

            # Construct RAR command
            # RAR automatically handles part naming
            archive_name = file_path + ".rar"
            
            cmd = [
                "rar", "a", 
                "-v4095M", 
                "-m0",  # Store mode for speed
                "-y",   # Assume yes on overwrite/questions
                archive_name, 
                file_path
            ]
            
            print(f"Starting command: {' '.join(cmd)}")
            
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
                        bufsize=1
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
def list_files(path: str = ""):
    return get_directory_contents(path)

@app.post("/api/split")
def start_split(request: SplitRequest):
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
def delete_rars(request: DeleteRequest):
    print(f"Delete request: {request}")
    target_path = os.path.abspath(os.path.join(DATA_DIR, request.path.strip(os.path.sep)))
    if not target_path.startswith(DATA_DIR):
        raise HTTPException(status_code=403, detail="Invalid path")

    deleted_count = 0
    import glob
    
    if request.mode == "single":
        # Delete specific file's RARs
        if not target_path.lower().endswith(".mkv"):
             raise HTTPException(status_code=400, detail="Target must be an MKV file")
             
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
def get_status():
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
def kill_process():
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
