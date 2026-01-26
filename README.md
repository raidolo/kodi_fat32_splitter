# 🎬 Kodi Fat32 Splitter

A modern, high-performance web dashboard designed to bridge the gap between large 4K/MKV media collections and **FAT32-formatted** drives (commonly used for Kodi, car systems, or legacy hardware). 

Built with **Python (FastAPI)** and **Vanilla JS**, it leverages the industrial-grade `rar` engine to split massive files into bit-perfect 4GB segments with zero overhead.

![Main Interface](screenshots/main_interface.png)

---

## 🚀 Key Features

- **📂 Smart File Navigator**: Browse your `/data` volume with a clean, responsive breadcrumb interface.
- **✂️ Bit-Perfect Splitting**:
    - Automatic 4095MB part calculation (maximum FAT32 safety).
    - Uses Store mode (`-m0`) for maximum speed (no re-compression).
- **🛡️ Integrity Engine**:
    - Real-time status detection: `NOT SPLITTED`, `PARTIAL`, or `SPLITTED`.
    - Automatically verifies the total archive size against the source MKV.
- **🔄 Fault-Tolerant Workflow**:
    - **Self-Cleaning**: Retrying a split automatically wipes old/corrupted parts.
    - **Force Kill**: Stop any runaway process instantly with immediate resource release.
- **🗑️ Advanced Deletion**: 
    - One-click deletion of RAR sets per file.
    - Bulk "Clean Folder" to sweep all RAR artifacts from a directory.
    - **Nuclear Deletion**: Bypasses Windows/Docker volume locks using a 10-retry `rm -f` system.
- **⚡ Reactive Dashboard**: Beautiful dark-mode UI with real-time polling—no page refreshes required.

---

## 🛠️ Tech Stack

- **Core**: FastAPI (Python 3.11) + Nginx
- **Logic**: Vanilla ES6 JavaScript (Modern & Lightweight)
- **Styling**: Custom CSS3 with Inter Typography
- **Runtime**: Docker Compose (Alpine Linux & Debian Slim)

---

## 🚦 Getting Started

### 1. Requirements
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### 2. Deployment
Clone the repo and configure your media directory:

```bash
git clone https://github.com/raidolo/kodi_fat32_splitter.git
cd kodi_fat32_splitter
```

Edit `docker-compose.yml` to point to your movies:
```yaml
# docker-compose.yml
volumes:
  - "/path/to/your/movies:/data"
```

Launch the stack:
```bash
docker-compose up -d --build
```

### 3. Usage
- Open `http://localhost`
- Navigate to your folder.
- Select your MKV and hit **"Start Split"**.
- Your `.rar` parts will appear in the same folder, ready for your FAT32 drive!

---

## 👨‍💻 Developer Notes
Developed for the **Kodi** community to handle massive 2160p releases on portable hardware.

> [!TIP]
> **Performance**: The app uses `rar` with `-m0` (Store), meaning it's limited only by your drive's I/O speed.

---

## 📜 License
*Note: This project provides a wrapper for the `rar` utility. Please ensure you comply with the [RAR License](https://www.rarlab.com/license.htm).*
