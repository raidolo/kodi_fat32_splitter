# Kodi Fat32 Splitter

A modern, Dockerized web application to manage and split MKV files into 4GB parts using WinRAR. Built with Python (FastAPI) and Vanilla JS, running on Alpine Linux.

## Features

- **📂 File Browser**: Navigate your `/data` volume to select MKV files.
- **✂️ Smart Splitting**:
    - Splits files into 4095MB parts (FAT32 compatible).
    - **Status Detection**: Automatically detects if a file is `SPLITTED` (Green) or `PARTIAL` (Orange/Warning).
    - **Integrity Check**: Verifies split validity by comparing total archive size vs original file size.
- **🔄 Auto-Cleanup**: Automatically removes old/incomplete artifacts when retrying a split.
- **🗑️ deletion**:
    - Delete individual RAR archives with a robust "Force Kill" logic (retries + system `rm -f`).
    - Bulk clean all RARs in a folder.
    - **Custom Modals**: Safe confirmation dialogs for destructive actions.
- **⚡ Reactive UI**: Real-time status updates via polling (no page reloads).
- **🛑 Process Control**: Stop/Kill running tasks immediately.

## Tech Stack

- **Backend**: Python 3.11 (FastAPI, Uvicorn)
- **Frontend**: Nginx, HTML5, CSS3, Vanilla JavaScript
- **Container**: Docker Compose (Alpine Linux base)
- **Core Utility**: `rar` (Linux x64)

## Prerequisites

- Docker & Docker Compose

## Installation & Running

1. **Clone the repository**:
   ```bash
   git clone <repository_url>
   cd "rar splitter v2"
   ```

2. **Configure Data Volume**:
   Open `docker-compose.yml` and ensure the volume mapping points to your actual media folder:
   ```yaml
   volumes:
     - "C:\Path\To\Your\Media:/data"
   ```

3. **Start the App**:
   ```bash
   docker-compose up -d --build
   ```

4. **Access the UI**:
   Open your browser and navigate to:
   [http://localhost](http://localhost)

## Usage

1. **Navigate**: Click folders to explore. Use `.. (Go Back)` to move up.
2. **Split**: Select a file (checkbox) and click **"Start Split"**.
   - The status badge will change to a spinner.
   - Once done, it turns **Green (SPLITTED)**.
3. **Stop**: If a task is running, click **"Stop Process"** to kill it immediately.
   - The status will turn **Orange (PARTIAL)**.
4. **Retry**: To fix a partial split, just click **"Start Split"** again. The app auto-cleans the mess.
5. **Delete**: Click the **Red Trash Icon** next to a split file to remove its RAR archives.

## Troubleshooting

- **"Permission Denied" on Delete**: The app uses a robust retry mechanism (10 attempts) and `rm -f` to bypass Windows/Docker file locking issues. If it fails, wait 10 seconds and try again.
- **File not found**: Ensure your Docker volume mapping is correct.
