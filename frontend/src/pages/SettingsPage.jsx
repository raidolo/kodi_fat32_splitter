import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Settings as SettingsIcon, ArrowLeft, Shield, Key, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppAuth } from '../auth/AuthProviderWrapper';

const SettingsPage = () => {
    const { settings, fetchSettings, updateSettings, loading, successMessage, setSuccessMessage } = useSettingsStore();
    const { user, loginLocal } = useAppAuth();

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwError, setPwError] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    useEffect(() => {
        if (user) {
            fetchSettings(user.token || user.access_token);
        }
    }, [fetchSettings, user]);

    // Clear success message after 5 seconds
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => {
                setSuccessMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [successMessage, setSuccessMessage]);

    // Check if password setup is required based on backend status or local flag (if passed)
    // We can infer it: if admin_email is set but password hash is null.
    const passwordMissing = settings.admin_email && settings.password_set === false;

    const handleChange = (key, value) => {
        updateSettings({ [key]: value }, user?.token || user?.access_token);
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setPwError('');
        setSuccessMessage(null);

        if (newPassword !== confirmPassword) {
            setPwError("New passwords do not match");
            return;
        }

        if (newPassword.length < 8) {
            setPwError("Password must be at least 8 characters");
            return;
        }

        setPwLoading(true);
        try {
            let token = localStorage.getItem('kodi_local_token');
            const endpoint = passwordMissing ? '/api/admin/set-password' : '/api/admin/password';

            // If changing existing password, ensure we have a valid token by logging in first
            // This handles cases where OIDC user lost local session
            if (!passwordMissing) {
                await loginLocal(settings.admin_email, currentPassword);
                // Token is now set in auth context and localStorage
                token = localStorage.getItem('kodi_local_token');
            }

            const body = passwordMissing
                ? { new_password: newPassword }
                : { current_password: currentPassword, new_password: newPassword };

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to update password");
            }

            setSuccessMessage("Password updated successfully!");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            // Refresh settings to clear warning
            fetchSettings();
        } catch (err) {
            setPwError(err.message);
        } finally {
            setPwLoading(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <header className="app-header">
                <div className="header-left">
                    <Link to="/" className="btn-icon" style={{ marginRight: '0.5rem', display: 'flex', alignItems: 'center' }} title="Back to Dashboard">
                        <ArrowLeft size={24} />
                    </Link>
                    <SettingsIcon className="logo-icon" size={28} />
                    <h1>Settings</h1>
                </div>
            </header>

            <div className="status-card">
                {/* Security Section */}
                <div className="status-header">
                    <h3><Shield size={20} style={{ marginRight: '8px', verticalAlign: 'text-bottom' }} /> Account Security</h3>
                </div>

                {passwordMissing && (
                    <div style={{
                        background: 'rgba(255, 77, 77, 0.1)',
                        border: '1px solid #ff4d4d',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        alignItems: 'start',
                        color: '#ff4d4d'
                    }}>
                        <AlertCircle size={24} style={{ marginRight: '1rem', flexShrink: 0 }} />
                        <div>
                            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Missing Fallback Password</h4>
                            <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.9 }}>
                                You are using OIDC but have no local password set.
                                <br />
                                <strong>If SSO fails, you will be locked out.</strong> Please set a password below immediately.
                            </p>
                        </div>
                    </div>
                )}

                <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '3rem' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                            Admin Email
                        </label>
                        <input
                            type="text"
                            value={settings.admin_email || user?.email || 'Not configured'}
                            disabled
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                        />
                    </div>

                    <div className="form-group" style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px' }}>
                        <h4 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center' }}>
                            <Key size={16} style={{ marginRight: '8px' }} /> Change Admin Password
                        </h4>
                        <form onSubmit={handlePasswordChange}>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                {!passwordMissing && (
                                    <input
                                        type="password"
                                        placeholder="Current Password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                                    />
                                )}
                                <input
                                    type="password"
                                    placeholder="New Password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                                />
                                <input
                                    type="password"
                                    placeholder="Confirm New Password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-primary)' }}
                                />

                                {pwError && <div className="error-message" style={{ color: '#ff6b6b' }}>{pwError}</div>}
                                {successMessage && (
                                    <div className="success-message" style={{
                                        color: '#2ea043',
                                        backgroundColor: 'rgba(46, 160, 67, 0.15)',
                                        border: '1px solid rgba(46, 160, 67, 0.4)',
                                        padding: '0.75rem',
                                        borderRadius: '6px',
                                        marginTop: '0.5rem',
                                        fontSize: '0.9rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        fontWeight: '500'
                                    }}>
                                        <Shield size={16} style={{ marginRight: '8px' }} />
                                        {successMessage}
                                    </div>
                                )}

                                <button type="submit" className="btn-primary" disabled={pwLoading} style={{ justifySelf: 'start' }}>
                                    {pwLoading ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                <div className="status-header">
                    <h3>Personalization</h3>
                </div>

                <div style={{ display: 'grid', gap: '2rem', marginBottom: '3rem' }}>
                    {/* Theme Selection */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                            Appearance
                        </label>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {['dark', 'light', 'cyberpunk'].map((theme) => (
                                <button
                                    key={theme}
                                    onClick={() => handleChange('theme', theme)}
                                    style={{
                                        flex: 1,
                                        padding: '1rem',
                                        borderRadius: '8px',
                                        border: `2px solid ${settings.theme === theme ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        textTransform: 'capitalize',
                                        fontWeight: settings.theme === theme ? 'bold' : 'normal',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {theme}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="status-header">
                    <h3>Core Behavior</h3>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {/* Subtitle Toggle */}
                    <div className="form-group">
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px' }}>
                            <div>
                                <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>Include Subtitles</h4>
                                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                    Automatically detect and include <code>.srt</code> files.
                                    Affects total size calculation.
                                </p>
                            </div>

                            <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '28px' }}>
                                <input
                                    type="checkbox"
                                    checked={settings.include_subtitles}
                                    onChange={(e) => handleChange('include_subtitles', e.target.checked)}
                                    style={{ opacity: 0, width: 0, height: 0 }}
                                />
                                <span style={{
                                    position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                                    backgroundColor: settings.include_subtitles ? 'var(--accent-color)' : '#444',
                                    transition: '.4s', borderRadius: '34px'
                                }}>
                                    <span style={{
                                        position: 'absolute', content: '""', height: '20px', width: '20px',
                                        left: settings.include_subtitles ? '26px' : '4px', bottom: '4px',
                                        backgroundColor: 'white', transition: '.4s', borderRadius: '50%'
                                    }}></span>
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: loading ? 1 : 0 }}>
                        {loading ? 'Saving...' : 'Saved'}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
