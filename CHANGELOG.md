# Changelog - Kodi Fat32 Splitter (dev)

All notable changes to the `dev` branch are documented below.

## [1.0.1] - 2026-01-30

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
