import React, { useState } from 'react';
import TaskControl from "../components/TaskControl";
import FileBrowser from "../components/FileBrowser";

const Dashboard = () => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [isTaskRunning, setIsTaskRunning] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const triggerRefresh = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    return (
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
    );
};

export default Dashboard;
