import React, { useEffect } from 'react';
import { useSettingsStore } from '../stores/useSettingsStore';
import { Settings as SettingsIcon, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const SettingsPage = () => {
    const { settings, fetchSettings, updateSettings, loading } = useSettingsStore();

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    const handleChange = (key, value) => {
        updateSettings({ [key]: value });
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
