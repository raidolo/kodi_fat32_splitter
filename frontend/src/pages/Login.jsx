import React, { useState, useEffect } from 'react';
import { useAppAuth } from '../auth/AuthProviderWrapper';
import { useNavigate } from 'react-router-dom';
import { Film, LogIn, Key, Shield, ChevronDown, ChevronRight } from 'lucide-react';

const Login = () => {
    const { loginLocal, signinRedirect, oidcEnabled } = useAppAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showLocal, setShowLocal] = useState(!oidcEnabled);
    const navigate = useNavigate();

    // Clear any manual logout flags
    useEffect(() => {
        sessionStorage.removeItem('kodi_manual_logout');
    }, []);

    const handleLocalLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await loginLocal(email, password);
            navigate('/');
        } catch (err) {
            setError(err.message || "Login failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-container">
            <div className="auth-notice">
                <Film size={64} className="logo-icon primary" />
                <h1>Kodi Fat32 Splitter</h1>
                <p>Secure High-Performance Media Management</p>

                <div className="login-containers">
                    {oidcEnabled && (
                        <div style={{ marginBottom: showLocal ? '2rem' : '0' }}>
                            <button className="btn-primary btn-large" onClick={() => signinRedirect()} style={{ width: '100%', justifyContent: 'center', backgroundColor: '#238636', borderColor: '#2xy8636' }}>
                                <Shield size={20} />
                                Login with SSO
                            </button>
                        </div>
                    )}

                    {oidcEnabled && (
                        <div
                            style={{
                                margin: '1.5rem 0',
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.9rem'
                            }}
                            onClick={() => setShowLocal(!showLocal)}
                        >
                            {showLocal ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span style={{ marginLeft: '4px' }}>Login with Local Admin</span>
                        </div>
                    )}

                    {showLocal && (
                        <form onSubmit={handleLocalLogin} className="auth-form" style={{ animation: 'fadeIn 0.3s', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px' }}>
                            {oidcEnabled && <div className="divider"><span>Local Admin</span></div>}
                            <div className="form-group">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="Email"
                                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', width: '100%' }}
                                />
                            </div>
                            <div className="form-group" style={{ marginTop: '1rem' }}>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="Password"
                                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)', width: '100%' }}
                                />
                            </div>

                            {error && <div className="error-message" style={{ color: '#ff6b6b', marginTop: '1rem' }}>{error}</div>}

                            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%', marginTop: '1.5rem', justifyContent: 'center' }}>
                                {loading ? 'Logging in...' : 'Login'}
                            </button>
                        </form>
                    )}
                </div>
            </div>

        </div>
    );
};

export default Login;
