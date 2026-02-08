import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Film, UserPlus, Shield } from 'lucide-react';
import { useAppAuth } from '../auth/AuthProviderWrapper';
import { version } from '../../package.json';

const Setup = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { oidcEnabled, signinRedirect } = useAppAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        if (password.length < 8) {
            setError("Password must be at least 8 characters");
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/api/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || 'Setup failed');
            }

            // Redirect to login after successful setup
            navigate('/login');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container">
            <div className="auth-notice">
                <Film size={64} className="logo-icon primary" />
                <h1>Kodi Fat32 Splitter</h1>
                <h2>Initial Setup</h2>
                <p>Create an Administrator Account</p>

                <form onSubmit={handleSubmit} className="auth-form" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Admin Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="admin@example.com"
                            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', width: '100%' }}
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="********"
                            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', width: '100%' }}
                        />
                    </div>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Confirm Password</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            placeholder="********"
                            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', width: '100%' }}
                        />
                    </div>

                    {error && <div className="error-message" style={{ color: '#ff6b6b', marginTop: '1rem' }}>{error}</div>}

                    <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}>
                        <UserPlus size={20} />
                        {loading ? 'Creating Account...' : 'Create Admin Account'}
                    </button>
                </form>

                {oidcEnabled && (
                    <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '2rem', marginBottom: '2rem' }}>
                        <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Or sign in with your Identity Provider</p>
                        <button
                            className="btn-primary btn-large"
                            onClick={() => signinRedirect()}
                            style={{ width: '100%', justifyContent: 'center', backgroundColor: '#238636', borderColor: '#2xy8636' }}
                        >
                            <Shield size={20} />
                            Login with SSO
                        </button>
                    </div>
                )}
            </div>
            <footer className="app-footer">
                <p>Vibe Coded by Antigravity &bull; 2026 &bull; v{version}</p>
            </footer>
        </div>
    );
};

export default Setup;
