const API_BASE = "/api";

// Elements
const fileListEl = document.getElementById("fileList");
const selectAllBtn = document.getElementById("selectAllBtn");
const deselectAllBtn = document.getElementById("deselectAllBtn");
const splitBtn = document.getElementById("splitBtn");
const killBtn = document.getElementById("killBtn");
const refreshBtn = document.getElementById("refreshBtn");
const selectedCountEl = document.getElementById("selectedCount");
const currentPathDisplay = document.getElementById("currentPathDisplay");
const deleteAllRarsBtn = document.getElementById("deleteAllRarsBtn");

const statusBadge = document.getElementById("statusBadge");
const progressBar = document.getElementById("progressBar");
const statusText = document.getElementById("statusText");
const consoleOutput = document.getElementById("consoleOutput");

let currentPath = "";
let pollingInterval = null;
let isTaskRunning = false;

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    fetchFiles("");
    startPolling();
});

// Event Listeners
refreshBtn.addEventListener("click", () => fetchFiles(currentPath));
selectAllBtn.addEventListener("click", () => updateAllSelection(true));
deselectAllBtn.addEventListener("click", () => updateAllSelection(false));
splitBtn.addEventListener("click", startSplitTask);
killBtn.addEventListener("click", killTask);
deleteAllRarsBtn.addEventListener("click", deleteFolderRars);

// Delegated Delete Listener
fileListEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".delete-btn");
    if (btn) {
        e.stopPropagation();
        const path = btn.getAttribute("data-path");
        if (path) {
            console.log("Delete button clicked for:", path);
            deleteFileRars(path);
        }
    }
});

// Functions
async function fetchFiles(path = "") {
    try {
        const encodedPath = encodeURIComponent(path);
        const res = await fetch(`${API_BASE}/files?path=${encodedPath}`);
        if (!res.ok) throw new Error("Failed to fetch files");

        const data = await res.json();
        currentPath = data.current_path;

        renderFileSystem(data);
        updateSelectionState();
    } catch (err) {
        console.error(err);
        fileListEl.innerHTML = `<li class="file-item error">Error loading files: ${err.message}</li>`;
    }
}

function renderFileSystem(data) {
    fileListEl.innerHTML = "";

    // Update Navigation UI
    currentPathDisplay.textContent = data.current_path ? `/${data.current_path}` : "/";

    // 1. Add Go Back Item if not root
    if (data.current_path) {
        const li = document.createElement("li");
        li.className = "file-item folder-item back-item";
        li.innerHTML = `
            <div class="file-info-group">
                <svg class="file-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                <span class="file-name" style="font-weight: bold;">.. (Go Back)</span>
            </div>
        `;
        li.onclick = () => {
            if (data.parent_path !== null) fetchFiles(data.parent_path);
            else fetchFiles("");
        };
        fileListEl.appendChild(li);
    }

    if (data.folders.length === 0 && data.files.length === 0 && !data.current_path) {
        fileListEl.innerHTML = `<li class="file-item placeholder">Folder is empty</li>`;
        return;
    }

    // Render Folders
    data.folders.forEach(folder => {
        const li = document.createElement("li");
        li.className = "file-item folder-item";
        li.innerHTML = `
            <div class="file-info-group">
                <svg class="file-icon folder-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
                <span class="file-name">${folder.name}</span>
            </div>
        `;
        li.onclick = (e) => {
            // Prevent if clicking buttons inside (if added later)
            fetchFiles(folder.path);
        };
        fileListEl.appendChild(li);
    });

    // Render Files
    data.files.forEach((file, index) => {
        const li = document.createElement("li");
        li.className = "file-item";

        const id = `file-${index}`;

        let badgeClass = "badge-split-no";
        let badgeText = "NOT SPLITTED";
        let showDelete = false;
        let sizeInfo = file.size_info || "";

        // Backend now returns 'status': 'SPLIT' | 'PARTIAL' | 'NONE'
        // Fallback for older api responses if needed
        const status = file.status || (file.is_split ? "SPLIT" : "NONE");

        if (status === "SPLIT") {
            badgeClass = "badge-split-yes";
            badgeText = "SPLITTED";
            showDelete = true;
        } else if (status === "PARTIAL") {
            badgeClass = "badge-split-warning";
            badgeText = "PARTIAL";
            showDelete = true; // Allow deleting partials to clean up
        }

        const deleteStyle = showDelete ? "" : "display:none; visibility:hidden;";

        // Escape quotes for attribute
        const safePath = file.path.replace(/"/g, '&quot;');
        li.innerHTML = `
            <input type="checkbox" id="${id}" value="${file.path}" class="file-chk">
            <label for="${id}" class="file-info-group">
                <svg class="file-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                <span class="file-name" title="${file.name}">${file.name}</span>
            </label>
            
            <div class="item-actions">
                <span class="badge ${badgeClass}" title="${status === 'PARTIAL' ? 'Size Mismatch: ' + sizeInfo : ''}">${badgeText}</span>
                <button class="btn btn-small btn-danger-outline btn-icon-only delete-btn" 
                        title="Delete RARs" 
                        style="${deleteStyle}"
                        data-path="${safePath}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `;

        fileListEl.appendChild(li);
    });

    // Re-attach listeners
    document.querySelectorAll(".file-chk").forEach(chk => {
        chk.addEventListener("change", updateSelectionState);
    });
}

function updateAllSelection(checked) {
    document.querySelectorAll(".file-chk").forEach(chk => {
        chk.checked = checked;
    });
    updateSelectionState();
}

function updateSelectionState() {
    const selected = document.querySelectorAll(".file-chk:checked");
    const count = selected.length;
    selectedCountEl.textContent = count;
    splitBtn.disabled = count === 0;
}

function getSelectedFiles() {
    return Array.from(document.querySelectorAll(".file-chk:checked")).map(chk => chk.value);
}

// Actions
// Modal Elements
const confirmModal = document.getElementById("confirmModal");
const confirmModalText = document.getElementById("confirmModalText");
const confirmOkBtn = document.getElementById("confirmOkBtn");
const confirmCancelBtn = document.getElementById("confirmCancelBtn");

let confirmCallback = null;

confirmCancelBtn.addEventListener("click", () => {
    confirmModal.style.display = "none";
    confirmCallback = null;
});

confirmOkBtn.addEventListener("click", () => {
    confirmModal.style.display = "none";
    if (confirmCallback) confirmCallback();
});

function showConfirm(message, onConfirm) {
    confirmModalText.textContent = message;
    confirmModal.style.display = "flex";
    confirmCallback = onConfirm;
}

// Actions
window.deleteFileRars = (path) => {
    showConfirm(`Delete RAR archives for this file?\n${path}`, async () => {
        try {
            const res = await fetch(`${API_BASE}/delete_rars`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "single", path: path })
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`Deleted ${data.count} files.`);
                fetchFiles(currentPath); // Refresh
            } else {
                alert("Failed to delete.");
            }
        } catch (e) {
            console.error(e);
            alert("Error requesting delete.");
        }
    });
};

async function deleteFolderRars() {
    showConfirm("Are you sure you want to DELETE ALL .rar files in this current folder?", async () => {
        try {
            const res = await fetch(`${API_BASE}/delete_rars`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode: "all", path: currentPath || "." })
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Deleted ${data.count} files in folder.`);
                fetchFiles(currentPath); // Refresh
            } else {
                alert("Failed to delete.");
            }
        } catch (e) {
            console.error(e);
            alert("Error requesting delete.");
        }
    });
}

async function startSplitTask() {
    const files = getSelectedFiles();
    if (files.length === 0) return;

    try {
        splitBtn.disabled = true;
        statusText.textContent = "Starting task...";

        const res = await fetch(`${API_BASE}/split`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ files: files })
        });

        if (!res.ok) {
            const err = await res.json();
            alert("Error: " + err.detail);
            splitBtn.disabled = false;
        } else {
            startPolling();
        }
    } catch (err) {
        console.error(err);
        alert("Failed to start task");
        splitBtn.disabled = false;
    }
}

async function killTask() {
    showConfirm("Are you sure you want to STOP the current process?\nThis might leave incomplete files.", async () => {
        try {
            await fetch(`${API_BASE}/kill`, { method: "POST" });
            statusText.textContent = "Termination requested...";
        } catch (err) { console.error(err); }
    });
}

function startPolling() {
    if (pollingInterval) return;
    pollStatus();
    pollingInterval = setInterval(pollStatus, 2000);
}

async function pollStatus() {
    try {
        const res = await fetch(`${API_BASE}/status`);
        if (!res.ok) return;
        const status = await res.json();
        updateStatusUI(status);
    } catch (err) {
        console.error("Polling error", err);
        document.getElementById("connectionStatus").style.color = "red";
        document.getElementById("connectionStatus").textContent = "Disconnected";
    }
}

function updateStatusUI(status) {
    document.getElementById("connectionStatus").style.color = "var(--accent-color)";
    document.getElementById("connectionStatus").textContent = "Connected";

    if (status.is_running) {
        isTaskRunning = true;
        statusBadge.textContent = "ACTIVE";
        statusBadge.classList.add("active");
        killBtn.disabled = false;
        splitBtn.disabled = true;

        let percent = 0;
        if (status.files_total > 0) {
            percent = Math.floor((status.files_processed / status.files_total) * 100);
        }

        progressBar.style.width = `${percent}%`;
        statusText.innerHTML = `Processing file ${status.files_processed + 1} of ${status.files_total}:<br><strong>${status.current_file || 'Initializing...'}</strong>`;
        consoleOutput.textContent = status.last_output || "Running...";
    } else {
        statusBadge.textContent = "IDLE";
        statusBadge.classList.remove("active");
        killBtn.disabled = true;

        // Check if we just finished a task
        if (isTaskRunning) {
            console.log("Task finished, refreshing list...");
            fetchFiles(currentPath);
            isTaskRunning = false;
        }

        const selected = document.querySelectorAll(".file-chk:checked").length;
        splitBtn.disabled = selected === 0;

        progressBar.style.width = "0%";
        if (status.files_processed > 0 && status.files_processed === status.files_total) {
            statusText.textContent = `Completed processing ${status.files_processed} files.`;
            consoleOutput.textContent = "Done.";
            // Auto refresh list to show new split status?
            // fetchFiles(currentPath); // Maybe annoying if it resets view, but good for status update
        } else {
            statusText.textContent = "Ready to process files.";
        }
    }
}
