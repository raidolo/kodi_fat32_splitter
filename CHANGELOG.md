# Changelog - Kodi Fat32 Splitter (dev)

All notable changes to the `dev` branch are documented below.

## [v1.1.6] - 2026-02-14

### 📝 Logging

- **OIDC Auth Logging**: Added per-session authentication logging inside `validate_oidc_token` — logs `🔑 [OIDC AUTH] User authenticated: email` only once per token to avoid spam from polling endpoints.
- **OIDC Failure Logging**: Key validation failures (missing JWKS key, missing email claim, general errors) now log with `⚠️ [OIDC]` prefix for easy filtering.
- **Logout Logging**: New lightweight `POST /api/auth/logout` endpoint that logs `🔓 [LOGOUT] User: email` and cleans up token tracking. Called fire-and-forget from the frontend before session cleanup.

## [v1.1.5] - 2026-02-13

### 🛡️ Security

- **Rate Limiting for `/api/auth/login`**: Added rate limiting (max 5 requests/minute per IP) to prevent brute-force attacks on the login endpoint.
- **Generalized Rate Limiter**: Refactored the rate limiting function to be reusable across endpoints (`login`, `setup`), with per-endpoint tracking and configurable limits.

### 📝 Logging

- **Auth Activity Logging**: Added console logging for security-relevant events:
    - Rate limit attempts and blocks for both `LOGIN` and `SETUP` endpoints (with IP, attempt count, and warning on block).
    - OIDC token validation failures and promote attempts.
- **Reduced Log Noise**: Removed per-request success logs from `get_current_user` to avoid spamming the console on every authenticated API call.

## [v1.1.4] - 2026-02-13

### 🧹 Cleanup

- **Removed `OIDC_LOGOUT`**: Removed the unused `OIDC_LOGOUT` environment variable from all configuration files (`.env.example`, `docker-compose.yml`, `config.js`, `entrypoint.sh`, `AuthProviderWrapper.jsx`). The OIDC end-session URL is automatically discovered via the provider's `.well-known/openid-configuration` endpoint.

### 📝 Documentation

- **Updated README**: Added a note clarifying that logout URL configuration is not needed — it is auto-discovered from the OIDC provider.

## [v1.1.3] - 2026-02-09

### 🛡️ Security Improvements

- **Automatic Setup Lockdown**: The `/api/setup` endpoint now automatically disables itself once an admin has both email AND password configured. No manual `SETUP_ENABLED` env var required.
- **Easy Reset**: To reconfigure, simply delete `config/settings.json` and restart.

### ⚙️ Configuration

- Removed `SETUP_ENABLED` environment variable (no longer needed).

## [v1.1.2] - 2026-02-09

### 🛡️ Security Fixes

- **Protected `/api/auth/promote-oidc`**: This critical endpoint now requires a valid OIDC token in the `Authorization` header. Previously, it was unauthenticated and could allow unauthorized admin promotion.
- **`SECRET_KEY` from Environment**: Moved JWT signing key from hardcoded value to environment variable. A random key is generated at startup if not set (with warning).
- **Rate Limiting for `/api/setup`**: Added rate limiting (max 5 requests/minute per IP) to prevent brute-force attacks on the setup endpoint.
- **`SETUP_ENABLED` Control**: New environment variable to disable the `/api/setup` endpoint after initial configuration.

### ⚙️ Configuration

- Added `SECRET_KEY` and `SETUP_ENABLED` to `.env.example`, `docker-compose.yml`, and `docker-compose.release.yml`.

## [v1.1.1] - 2026-02-09

### 🚀 Performance

- **OIDC Caching**: Implemented caching for OIDC Discovery and JWKS (1-hour TTL), preventing repeated calls to the Identity Provider on every API request.
- **UserInfo Caching**: Added per-token UserInfo caching (5-minute TTL) to avoid rate-limiting ("Too Many Requests" errors) from the OIDC provider.

### 🐛 Bug Fixes

- **Page Refresh Persistence**: Fixed a race condition where the `FileBrowser` component would show an empty list after a page refresh because authentication state was not yet restored.
- **Silent Renew**: Updated `silent-renew.html` to use a compatible `oidc-client-ts` version and correct storage strategy, preventing authentication loops.
- **Session Monitoring**: Disabled `monitorSession` to prevent aggressive polling of the Identity Provider.

## [v1.1.0] - 2026-02-09

### 🛡️ Security Overhaul
This release introduces a major security hardening of the application, particularly focusing on OIDC integration and API protection.

- **OIDC Configuration (Breaking Change)**: 
    - The application now strictly enforces the **PKCE (Proof Key for Code Exchange)** flow.
    - **Action Required**: You must update your Identity Provider (e.g., Pocket ID) client configuration to be **Public** (confidentiality disabled) and enable **PKCE**.
    - Removed usage of `OIDC_CLIENT_SECRET` from all frontend and backend configurations.
    - Added **Dynamic OIDC Discovery**: The backend now automatically fetches `jwks_uri` and `userinfo_endpoint` from `/.well-known/openid-configuration`, ensuring compatibility with various providers (tested with Pocket ID).
    - **Backend Token Validation**: Implemented strict validation of OIDC tokens (RS256) on the backend using remote JWKS. This prevents unverified access to protected resources.

- **API Hardening**:
    - **Endpoint Protection**: All sensitive API endpoints (`/api/files`, `/api/split`, `/api/delete_rars`) now require authentication.
    - **Data Sanitization**: The `/api/settings` endpoint no longer returns the `admin_password_hash`. A new `password_set` boolean is returned instead.
    - **UserInfo Fallback**: Backend now correctly fetches user email from the UserInfo endpoint if it's missing from the Access Token claims.

### ✨ UX Improvements
- **Improved Setup Flow**: After creating the initial local admin account, you are now automatically redirected to the Login page instead of remaining on the Setup screen.
- **Smart Warnings**: The "Missing Fallback Password" warning in Settings now correctly tracks the password state even with the hash redacted from the API.

### 🐛 Bug Fixes
- Fixed an issue where OIDC users could login but were unable to view files due to backend token rejection (`HS256` vs `RS256` mismatch).

## [v1.0.13] - 2026-02-09

### 🐛 Bug Fixes
- **Light Theme Readability**: Fixed an issue where the header title was unreadable (white on white) in Light Mode by introducing a theme-aware CSS variable.

## [v1.0.12] - 2026-02-08

### 🐛 Bug Fixes
- **OIDC Logout Reliability**: switched to using the official `signoutRedirect` method from the OIDC library instead of manual URL construction. This ensures correct usage of the `end_session_endpoint` from the discovery document and proper `id_token__hint` handling.

## [v1.0.11] - 2026-02-08

### 🐛 Bug Fixes
- **Production OIDC Logout**: Fixed a race condition where the `id_token` was cleared from the session before the logout redirect could be constructed, causing the redirect to fail in some environments.

## [v1.0.10] - 2026-02-08

### 🎨 UI & Polish
- **Unified Styling**: Login and Setup pages now match the Settings page aesthetic (consistent forms, green SSO buttons).
- **Footer Improvements**: 
    - Added version number (`v1.0.10`) to the global footer.
    - Fixed overlap issues on the Setup page.
    - Removed duplicate footer from the Login page.

### 🛡️ Security & Authentication
- **OIDC First-Run Experience**: 
    - The first user to login via SSO is automatically promoted to Admin.
    - **Fallback Password Requirement**: OIDC users are now prompted (via a critical warning in Settings) to set a local admin password to ensure access even if the identity provider is unavailable.
- **Local Admin Logout**: Fixed logic to ensure local admins are redirected to the login page instead of the OIDC provider upon logout.
- **Password Change Feedback**: Implemented global state for success messages (`useSettingsStore`) to prevent feedback from disappearing during component re-renders.

## [v1.0.9] - 2026-02-08

### 🔐 Authentication & Security
- **Enhanced OIDC Logout**:
    - **End-Session Redirect**: Logging out now properly redirects to the Identity Provider (`OIDC_LOGOUT`) to invalidate the remote session.
    - **Smart Parameters**: Automatically appends `client_id`, `post_logout_redirect_uri`, and `id_token_hint` for a seamless flow.
    - **Loop Prevention**: Fixed a critical issue where the application would auto-login immediately after a manual logout.

## [v1.0.8] - 2026-02-04

### 🐛 Bug Fixes
- **Initialization**: Added startup event to ensure `settings.json` is generated immediately when the backend container starts, rather than waiting for the first API call.

## [v1.0.7] - 2026-02-04

### 🐛 Bug Fixes
- **Settings Persistence**: Fixed an issue where `settings.json` was not created with default values on the first run, causing settings to not persist correctly until manually saved.

## [v1.0.6] - 2026-02-04

### ⚙️ Settings System
- **New Settings Page**: Dedicated configuration area accessible via the header icon.
- **Theme Selection**:
    - **Dark** (Default)
    - **Light**: For high-brightness environments.
    - **Cyberpunk**: A neon-heavy aesthetic.
    - *Themes apply instantly upon selection.*
- **Subtitle Management**:
    - **Include Subtitles Toggle**: Enable/Disable automatic inclusion of `.srt` files.
    - When disabled, `.srt` files are ignored during splitting and size calculation.

### 🛡️ Core Reliability
- **Strict Validation Logic**: 
    - Replaced percentage-based validation (1%-10%) with **Fixed Buffer Validation**.
    - Max allowed overhead is now **2KB per RAR volume** (ignoring header size).
    - This ensures extremely precise detection of incomplete or modified archives (e.g., if unwanted headers or files are present).

### 🐛 Fixes & Improvements
- **Router Integration**: Added `react-router-dom` for seamless navigation between Dashboard and Settings.
- **UI UX**: Added "Back" button to Settings page for easy return to dashboard.
- **Backend**: Fixed indentation regression in file scanner caused by settings logic integration.

## [v1.0.5] - 2026-02-03

### 📱 UI & Mobile Optimization
- **Responsive Layout**: Badges automatically wrap below the filename on small screens (<768px), preventing horizontal overlap.
- **Improved Status Console**:
    - **Text Comparison**: Console messages now wrap properly instead of being truncated.
    - **Icon Alignment**: Fixed status icon alignment and prevented it from shrinking on long messages.
- **Status Badge Relocation**: Moved status indicators (SPLIT/PARTIAL) to the shared badge container for consistent mobile wrapping.
- **Wider Desktop View**: Increased max-width to 1200px for better use of screen real estate.

### 🎬 Subtitle Support
- **Automatic Detection**: Logic now scans for `.srt` files matching the video filename (e.g., `movie.en.srt`).
- **Zero-Config**: Detected subtitles are **automatically included** in the RAR archive by default. No manual selection or settings required.
- **Smart Sizing**: "Subs" badge added to UI, and subtitle size is included in the total size calculation for FAT32 optimization.

### 🛠 Improvements & Fixes
- **RAR Relative Paths**: Fixed an issue where archives contained full absolute paths or parent directories.
    - Archives now strictly contain only the video file and its subtitles at the root level.
    - Implemented execution with `cwd` set to the file's directory to ensure clean paths.

## [v1.0.4] - 2026-02-02

### ⬆️ Dependency Updates
- **ESLint & Plugins**: Updated to latest 2026 versions to resolve deprecation warnings and improve code quality checks.
    - `eslint`: `^9.39.2`
    - `eslint-plugin-react`: `^7.37.5`
    - `eslint-plugin-react-hooks`: `^7.0.1`
    - `globals`: `^17.3.0`

## [v1.0.3] - 2026-02-02

### 🆕 New Features
- **File Size Badge**: Added visual indicator of file size next to filenames.
    - **Green Badge**: Files < 4GB (Safe, no split needed).
    - **Red Badge**: Files >= 4GB (Exceeds FAT32 limit, split required).

### 🛠 Improvements
- **Refactoring**: Renamed backend variables (e.g., `mkv_size` -> `file_size`) to be semantically generic for multi-format support.

## [v1.0.2] - 2026-02-02

### 🆕 New Features
- **MP4 Support**: Added full support for splitting and managing `.mp4` (and `.MP4`) files, in addition to `.mkv`.
- **UI Improvements**: Unlocked "Delete" actions during active split tasks. You can now delete unrelated files while a background job is running.

## [v1.0.1] - 2026-01-30

### 🐳 CI/CD & Deployment
- **Automated Docker Builds**: Implemented GitHub Actions workflow to build and push images to **GitHub Container Registry (GHCR)** automatically on release.
- **Production Artifacts**: Added `docker-compose.release.yml` for simplified deployment using pre-built images.
- **Manual Trigger**: Added support for manually dispatching the workflow for existing tags or custom versions.
- **Documentation**: Overhauled README with a streamlined "Quick Start" guide and Docker Image usage instructions.
- **Config**: Enforced LF line endings for shell scripts via `.gitattributes` to ensure cross-platform Docker compatibility.

### 🗑️ Cleanup
- Removed legacy frontend code (vanilla JS/HTML/CSS) to clean up the repository.

### 🚀 New Features (from 1.0.0 Dev)
- **Mobile UX Refactor**:
    - **Folder Navigation**: Clicking folder names now directly navigates into them, improving touch usability.
    - **File Expansion**: Clicking filenames expands them to show the full text (multiline), solving the issue of truncated long names on mobile.
    - **Interactive Feedback**: Decoupled row selection from interaction; removed marquee animations in favor of static, clean text expansion.
- **RAR Part Counting**:
    - Status badges now verify and display the exact number of RAR parts created (e.g., `SPLIT (3 parts)`).
    - Backend logic updated to count `.partN.rar` files accurately.
- **OIDC Authentication**:
    - Full integration with Pocket-ID using PKCE flow.
    - Runtime toggle `VITE_USE_OIDC` to switch between Mock Auth (dev) and Real OIDC.
- **Logout Confirmation**: Added a confirmation modal before logging out to prevent accidental exits.
- **Bulk Actions**:
    - "Delete All RARs" button added to the file browser header.
    - "Select All" / "Deselect All" toolbar for batch operations.
- **Manual Refresh**: Added a dedicated refresh button to re-sync the file list without reloading the page.

### 🛠 Improvements & Refinements
- **UI Polish**:
    - Migrated frontend to **React (Vite)** with a "Cyberpunk/Dark" aesthetic.
    - Layout fixes: Single-row alignment for header actions, better vertical alignment for icons.
    - Visual feedback on "Stop Process" (red alert).
- **Backend Robustness**:
    - Implemented "Force Delete" logic to handle stubborn file locks (chmod + rm -f fallback).
    - Stricter size verification (RAR total size ≈ Original MKV size) to prevent false positives on "SPLIT" status.
- **Configuration**:
    - Centralized environment variables in `docker-compose.yml`.
    - Removed hardcoded frontend `.env` files in favor of runtime injection (`entrypoint.sh`).

### 🐛 Bug Fixes
- Fixed folder navigation on mobile devices (click targets).
- Fixed persistent file deletion failures on Windows/Docker volumes.
- Fixed issue where clicking a row would accidentally toggle selection instead of just highlighting.
- Fixed marquee animation causing visual glitches on long filenames.

---

*Generated based on development task history.*
