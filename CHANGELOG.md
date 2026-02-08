# Changelog - Kodi Fat32 Splitter (dev)

All notable changes to the `dev` branch are documented below.

## [v1.0.10] - 2026-02-08

### 🎨 UI & Polish
- **Unified Styling**: Login and Setup pages now match the Settings page aesthetic (consistent forms, green SSO buttons).
- **Footer Improvements**: 
    - Added version number (`v1.0.10`) to the global footer.
    - Fixed overlap issues on the Setup page.
    - Removed duplicate footer from the Login page.

### 🐛 Bug Fixes
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
