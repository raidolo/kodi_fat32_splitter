import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Play, Square, Loader2, Info } from 'lucide-react';
import { useAppAuth } from '../auth/AuthProviderWrapper';

const TaskControl = ({ selectedFiles, onTaskChange, onTaskComplete }) => {
    const { user } = useAppAuth();
    const [status, setStatus] = useState({ is_running: false, progress: 0, last_output: '' });
    const [lastStatusRunning, setLastStatusRunning] = useState(false);
    const [loading, setLoading] = useState(false);
    const [stopFeedback, setStopFeedback] = useState(null); // Feedback message state

    const getAuthHeaders = () => {
        const token = user?.token;
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    };

    const fetchStatus = async () => {
        try {
            const response = await axios.get('/api/status', getAuthHeaders());
            setStatus(response.data);
            onTaskChange(response.data.is_running);

            // Auto-refresh logic: detect transition from running -> not running
            if (lastStatusRunning && !response.data.is_running) {
                if (onTaskComplete) onTaskComplete();
            }
            setLastStatusRunning(response.data.is_running);
        } catch (error) {
            console.error('Error fetching status:', error);
        }
    };

    useEffect(() => {
        fetchStatus(); // Fetch immediately
        const interval = setInterval(fetchStatus, 2000);
        return () => clearInterval(interval);
    }, [lastStatusRunning, user?.token]);

    const handleStart = async () => {
        if (!selectedFiles || selectedFiles.length === 0) return;
        setLoading(true);
        setStopFeedback(null); // Clear previous stop feedback
        try {
            await axios.post('/api/split', {
                files: selectedFiles.map(f => f.name)  // Extract path strings from array
            }, getAuthHeaders());
            fetchStatus();
        } catch (error) {
            console.error('Error starting task:', error);
            alert("Failed to start task: " + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    const handleKill = async () => {
        setLoading(true);
        try {
            await axios.post('/api/kill', {}, getAuthHeaders());
            setStopFeedback("Process stopped by user"); // Set feedback message
            fetchStatus();
        } catch (error) {
            console.error('Error killing task:', error);
        } finally {
            setLoading(false);
        }
    };

    const isRunning = status.is_running;

    return (
        <div className="task-control status-card">
            <div className="status-header">
                <h2>Task Status</h2>
                <span className={`status-badge ${isRunning ? 'active' : ''}`}>
                    {isRunning ? 'RUNNING' : 'IDLE'}
                </span>
            </div>

            <div className="status-body">
                <div className="progress-container">
                    <div
                        className="progress-bar-fill"
                        style={{ width: `${status.progress || (isRunning ? 100 : 0)}%` }} // Fake progress if running
                    ></div>
                </div>

                <div className="status-info">
                    <p className="status-text">
                        {isRunning ? `Processing...` : 'Ready to process files.'}
                    </p>

                    {/* Visual Feedback for Stopped Process */}
                    {!isRunning && stopFeedback && (
                        <div className="feedback-message" style={{ color: '#da3633', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Square size={14} fill="currentColor" />
                            {stopFeedback}
                        </div>
                    )}

                    {status.last_output && (
                        <div className="console-output">
                            <Info size={14} />
                            <span>{status.last_output}</span>
                        </div>
                    )}
                </div>

                <div className="control-actions">
                    <button
                        className="btn-primary"
                        onClick={handleStart}
                        disabled={!selectedFiles || selectedFiles.length === 0 || loading || isRunning}
                        title={(!selectedFiles || selectedFiles.length === 0) ? "Select files first" : "Start splitting"}
                    >
                        {loading && !isRunning ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
                        Start Split
                    </button>

                    <button
                        className="btn-danger"
                        onClick={handleKill}
                        disabled={loading || !isRunning}
                        title="Stop the running process"
                    >
                        {loading && isRunning ? <Loader2 className="animate-spin" size={18} /> : <Square size={18} />}
                        Stop Process
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TaskControl;
