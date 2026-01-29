import { useState } from "react";
import { useAppAuth } from "./auth/AuthProviderWrapper";
import { LogIn, Film, LogOut, RefreshCw } from "lucide-react";
import FileBrowser from "./components/FileBrowser";
import TaskControl from "./components/TaskControl";
import ConfirmationModal from "./components/ConfirmationModal";
import "./App.css";
import { version } from "../package.json";

function App() {
  const auth = useAppAuth();
  const [selectedFiles, setSelectedFiles] = useState([]); // Array of selected files
  const [isTaskRunning, setIsTaskRunning] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    auth.removeUser();
  };

  // ... (auth checks remain same)

  if (!auth.isAuthenticated) {
    // ... (login screen remains same)
    return (
      <div className="app-container">
        <div className="auth-notice">
          <Film size={64} className="logo-icon primary" />
          <h1>Kodi Fat32 Splitter</h1>
          <p>Secure High-Performance Media Management</p>
          <button className="btn-primary btn-large" onClick={() => auth.signinRedirect()}>
            <LogIn size={20} />
            Login with OIDC
          </button>
        </div>
        <footer className="app-footer">
          <p>Vibe Coded by Antigravity &bull; 2026 &bull; v{version}</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-left">
          <Film size={28} className="logo-icon" />
          <h1>Kodi Fat32 Splitter</h1>
        </div>
        <div className="header-right">
          <div className="user-profile">
            <span className="username">{auth.user?.profile.preferred_username || auth.user?.profile.name}</span>
            <button className="btn-icon btn-logout" title="Log Out" onClick={handleLogoutClick}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-grid">
        <TaskControl
          selectedFiles={selectedFiles}
          onTaskChange={setIsTaskRunning}
          onTaskComplete={triggerRefresh}
        />

        <section className="manager-panel">
          <div className="panel-header">
            <h2>Files</h2>
            <div className="panel-actions">
              <span className="selection-info">
                {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'No files selected'}
              </span>
            </div>
          </div>

          <FileBrowser
            selectedFiles={selectedFiles}
            onSelect={setSelectedFiles}
            isLocked={isTaskRunning}
            refreshTrigger={refreshTrigger}
            onManualRefresh={triggerRefresh}
          />
        </section>
      </main>

      <footer className="app-footer">
        <p>Vibe Coded by Antigravity &bull; 2026 &bull; v{version}</p>
      </footer>

      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Log Out"
      />
    </div>
  );
}

export default App;
