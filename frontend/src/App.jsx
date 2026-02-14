import { useState, useEffect } from "react";
import { useAppAuth, getRuntimeConfig } from "./auth/AuthProviderWrapper";
import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import { Film, LogOut, Settings as SettingsIcon, RefreshCw } from "lucide-react";
import ConfirmationModal from "./components/ConfirmationModal";
import SettingsPage from "./pages/SettingsPage";
import Dashboard from "./pages/Dashboard";
import Setup from "./pages/Setup";
import Login from "./pages/Login";
import "./App.css";
import { version } from "../package.json";

function App() {
  const auth = useAppAuth();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [setupRequired, setSetupRequired] = useState(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Check setup status on mount
  useEffect(() => {
    fetch('/api/auth/status')
      .then(res => res.json())
      .then(data => {
        setSetupRequired(data.setup_required);
      })
      .catch(err => console.error("Failed to check auth status", err))
      .finally(() => setCheckingSetup(false));
  }, []);

  // Auto-promote OIDC user if setup is required
  useEffect(() => {
    if (setupRequired && auth.oidcEnabled && auth.isAuthenticated && auth.user?.profile?.email) {
      console.log("Auto-promoting OIDC user as admin...");
      fetch('/api/auth/promote-oidc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.user.access_token}`
        },
        body: JSON.stringify({})
      })
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            // Store the token so we can set the password
            auth.setAuthToken(data.access_token);
            setSetupRequired(false);
            // Redirect to settings to show the warning
            window.location.href = '/settings';
            console.log("OIDC User promoted to Admin, token received.");
          } else if (data.status === 'promoted') {
            // Fallback if no token returned (legacy check)
            setSetupRequired(false);
            window.location.href = '/settings';
          }
        })
        .catch(err => console.error("Failed to promote OIDC user", err));
    }
  }, [setupRequired, auth.isAuthenticated, auth.user, auth.oidcEnabled]);

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = () => {
    sessionStorage.setItem('kodi_manual_logout', 'true');
    setIsLogoutModalOpen(false);

    // Notify backend of logout (fire-and-forget)
    if (auth.user?.token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${auth.user.token}` }
      }).catch(() => { }); // Ignore errors — logout should proceed regardless
    }

    // If OIDC user, use library method for proper end-session (handles id_token_hint and URL discovery)
    if (auth.oidcEnabled && auth.user?.id_token) {
      // Clear local token state first (but don't call auth.logout() as it wipes OIDC user needed for signout)
      auth.setAuthToken(null);
      auth.signoutRedirect({ post_logout_redirect_uri: window.location.origin });
    } else {
      // Local logout
      auth.logout();
    }
  };

  if (auth.isLoading || checkingSetup) {
    return (
      <div className="app-container">
        <div className="auth-notice">
          <RefreshCw className="failed-icon spin" size={48} style={{ animation: 'spin 1s linear infinite' }} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Force setup if required
  if (setupRequired) {
    return <Setup onSetupComplete={() => setSetupRequired(false)} />;
  }

  return (
    <div className="app-container">
      {auth.isAuthenticated && (
        <header className="app-header">
          <div className="header-left">
            <Film size={28} className="logo-icon" />
            <h1>Kodi Fat32 Splitter</h1>
          </div>
          <div className="header-right">
            <div className="user-profile">
              <span className="username">{auth.user?.profile?.preferred_username || auth.user?.profile?.name || "User"}</span>
              <Link to="/settings" className="btn-icon" title="Settings">
                <SettingsIcon size={18} />
              </Link>
              <button className="btn-icon btn-logout" title="Log Out" onClick={handleLogoutClick}>
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>
      )}

      <Routes>
        <Route path="/login" element={auth.isAuthenticated ? <Navigate to="/" /> : <Login />} />
        <Route path="/setup" element={setupRequired ? <Setup /> : <Navigate to="/" />} />

        <Route path="/" element={
          auth.isAuthenticated ? <Dashboard /> : <Navigate to="/login" />
        } />

        <Route path="/settings" element={
          auth.isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />
        } />
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
