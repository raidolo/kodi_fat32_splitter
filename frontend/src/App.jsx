import { useState, useEffect } from "react";
import { useAppAuth, getRuntimeConfig } from "./auth/AuthProviderWrapper";
import { Routes, Route, Link } from "react-router-dom";
import { LogIn, Film, LogOut, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import FileBrowser from "./components/FileBrowser";
import TaskControl from "./components/TaskControl";
import ConfirmationModal from "./components/ConfirmationModal";
import SettingsPage from "./pages/SettingsPage";
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
    sessionStorage.setItem('kodi_manual_logout', 'true');
    auth.removeUser();
    setIsLogoutModalOpen(false);

    // Redirect to OIDC provider logout if configured
    const config = getRuntimeConfig();
    if (config.oidcLogout) {
      const logoutUrl = new URL(config.oidcLogout);

      if (config.clientId) {
        logoutUrl.searchParams.append('client_id', config.clientId);
      }

      logoutUrl.searchParams.append('post_logout_redirect_uri', window.location.origin);

      const idToken = auth.user?.id_token;
      if (idToken) {
        logoutUrl.searchParams.append('id_token_hint', idToken);
      }

      window.location.href = logoutUrl.toString();
    }
  };

  // ... (auth checks remain same)

  // Auto-Login: Redirect to IdP if not authenticated
  useEffect(() => {
    // Check if user manually logged out
    const manualLogout = sessionStorage.getItem('kodi_manual_logout');

    // Only attempt if not authenticated, not loading, using OIDC, AND NOT manually logged out
    if (!auth.isAuthenticated && !auth.isLoading && auth.signinRedirect && !manualLogout) {
      auth.signinRedirect();
    }
  }, [auth]);

  // Check if user manually logged out - need to read this for rendering logic too
  const manualLogout = sessionStorage.getItem('kodi_manual_logout');

  if (auth.isLoading || (!auth.isAuthenticated && auth.signinRedirect && !manualLogout)) {
    return (
      <div className="app-container">
        <div className="auth-notice">
          <RefreshCw className="failed-icon spin" size={48} style={{ animation: 'spin 1s linear infinite' }} />
          <p>Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    // ... (login screen remains same)
    return (
      <div className="app-container">
        <div className="auth-notice">
          <Film size={64} className="logo-icon primary" />
          <h1>Kodi Fat32 Splitter</h1>
          <p>Secure High-Performance Media Management</p>
          <button className="btn-primary btn-large" onClick={() => {
            sessionStorage.removeItem('kodi_manual_logout');
            auth.signinRedirect();
          }}>
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
            <Link to="/settings" className="btn-icon" title="Settings">
              <SettingsIcon size={18} />
            </Link>
            <button className="btn-icon btn-logout" title="Log Out" onClick={handleLogoutClick}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={
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
        } />

        <Route path="/settings" element={<SettingsPage />} />
      </Routes>

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
