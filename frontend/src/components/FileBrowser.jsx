import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Folder, File, ChevronLeft, Trash2, CheckCircle2, AlertTriangle, Loader2, RefreshCw, CheckSquare, XSquare } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

const FileBrowser = ({ selectedFiles, onSelect, isLocked, refreshTrigger, onManualRefresh }) => {
    const [currentPath, setCurrentPath] = useState('');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedFiles, setExpandedFiles] = useState({});

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deleteMode, setDeleteMode] = useState('single'); // 'single' or 'all'
    const [fileToDelete, setFileToDelete] = useState(null);

    const FAT32_LIMIT = 4095 * 1024 * 1024; // 4095 MB in bytes

    const formatBytes = (bytes, decimals = 1) => {
        if (!+bytes) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    const toggleExpand = (name) => {
        setExpandedFiles(prev => ({
            ...prev,
            [name]: !prev[name]
        }));
    };

    const fetchFiles = async (path) => {
        setLoading(true);
        setExpandedFiles({}); // Reset expansion on navigation
        try {
            const response = await axios.get(`/api/files?path=${encodeURIComponent(path)}`);
            // Backend returns explicit 'folders' and 'files' lists. We merge them for the UI.
            const combined = [
                ...response.data.folders.map(f => ({ ...f, is_dir: true })),
                ...response.data.files.map(f => ({ ...f, is_dir: false, is_media: /\.(mkv|mp4)$/i.test(f.name) }))
            ];
            setFiles(combined);
            // Don't overwrite current path if just refreshing, unless explicit navigation
            if (path !== undefined) setCurrentPath(path);
        } catch (error) {
            console.error('Error fetching files:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch files when component mounts, or when path/refreshTrigger changes
        fetchFiles(currentPath);
    }, [refreshTrigger, currentPath]);

    const handleFolderClick = (name) => {
        const newPath = currentPath ? `${currentPath}/${name}` : name;
        setCurrentPath(newPath); // Updates state, triggering useEffect
    };

    const handleGoBack = () => {
        const parts = currentPath.split('/');
        parts.pop();
        setCurrentPath(parts.join('/'));
    };

    const handleSelect = (file) => {
        if (file.is_dir) {
            handleFolderClick(file.name);
        } else if (file.is_media) {
            // Toggle Logic
            const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
            const isSelected = selectedFiles.some(f => f.name === fullPath);
            const fileObj = { name: fullPath };

            if (isSelected) {
                onSelect(selectedFiles.filter(f => f.name !== fullPath));
            } else {
                onSelect([...selectedFiles, fileObj]);
            }
        }
    };

    const handleSelectAll = () => {
        const allMediaFiles = files
            .filter(f => !f.is_dir && f.is_media)
            .map(f => ({ name: currentPath ? `${currentPath}/${f.name}` : f.name }));

        // Merge with existing selection to avoid duplicates
        const newSelection = [...selectedFiles];
        allMediaFiles.forEach(file => {
            if (!newSelection.some(sel => sel.name === file.name)) {
                newSelection.push(file);
            }
        });
        onSelect(newSelection);
    };

    const handleDeselectAll = () => {
        onSelect([]);
    };

    const confirmDelete = (e, file) => {
        e.stopPropagation();
        setDeleteMode('single');
        setFileToDelete(file);
        setIsModalOpen(true);
    };

    const confirmDeleteAll = () => {
        setDeleteMode('all');
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        try {
            if (deleteMode === 'single' && fileToDelete) {
                const fullPath = currentPath ? `${currentPath}/${fileToDelete.name}` : fileToDelete.name;
                await axios.post('/api/delete_rars', {
                    path: fullPath,
                    mode: 'single'
                });
            } else if (deleteMode === 'all') {
                const targetDir = currentPath || '';
                await axios.post('/api/delete_rars', {
                    path: targetDir,
                    mode: 'all'
                });
            }

            setIsModalOpen(false);
            setFileToDelete(null);
            fetchFiles(currentPath); // Refresh list
        } catch (error) {
            console.error('Error deleting files:', error);
            alert('Failed to delete files');
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'SPLIT': return <CheckCircle2 size={16} className="text-success" />;
            case 'PARTIAL': return <AlertTriangle size={16} className="text-warning" />;
            default: return null;
        }
    };

    return (
        <div className="file-browser">
            <ConfirmationModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleDelete}
                title={deleteMode === 'all' ? "Delete All RARs?" : "Delete RAR Files?"}
                message={deleteMode === 'all'
                    ? "Are you sure you want to delete ALL .rar files in this folder? This action cannot be undone."
                    : `Are you sure you want to delete RAR files for "${fileToDelete?.name}"?`
                }
            />

            <div className="browser-header">
                <div className="path-display">
                    {/* Navigation Group */}
                    <div className="nav-group" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                            className="btn-icon"
                            title="Refresh"
                            onClick={onManualRefresh}
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        </button>

                        {currentPath ? (
                            <button
                                className="btn-secondary"
                                onClick={handleGoBack}
                            >
                                <ChevronLeft size={18} />
                                Go Back
                            </button>
                        ) : (
                            <span className="current-path-root">
                                <Folder size={18} />
                                /data
                            </span>
                        )}
                    </div>

                    {currentPath && (
                        <span className="current-path-text">
                            /{currentPath}
                        </span>
                    )}
                </div>

                <div className="browser-actions">
                    {files.some(f => !f.is_dir) && (
                        <button
                            className="btn-icon btn-danger-icon"
                            title="Delete All RARs"
                            onClick={confirmDeleteAll}
                        >
                            <Trash2 size={18} />
                            <span className="btn-label-sm">All</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="file-list-container">
                <div className="selection-bar">
                    <button
                        className="btn-secondary"
                        onClick={handleSelectAll}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                        disabled={isLocked}
                    >
                        <CheckSquare size={16} />
                        Select All
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={handleDeselectAll}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                        disabled={isLocked || selectedFiles.length === 0}
                    >
                        <XSquare size={16} />
                        Deselect All
                    </button>
                </div>

                {loading ? (
                    <div className="loading-state"><Loader2 className="animate-spin" /> Loading files...</div>
                ) : (
                    <ul className="file-list">
                        {files.map((file) => {
                            // Robust selection check
                            const fullPath = currentPath ? `${currentPath}/${file.name}` : file.name;
                            const isSelected = selectedFiles.some(f => f.name === fullPath);

                            return (
                                <li
                                    key={file.name}
                                    className={`file-item ${isSelected ? 'selected' : ''}`}
                                >
                                    <div className="file-main">
                                        {file.is_dir ? (
                                            <div onClick={() => handleFolderClick(file.name)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                                <Folder size={20} className="folder-icon" />
                                            </div>
                                        ) : (
                                            <div
                                                className="checkbox-wrapper"
                                                onClick={() => handleSelect(file)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', paddingRight: '0.5rem' }}
                                            >
                                                {file.is_media && (
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        readOnly
                                                        className="file-checkbox"
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                )}
                                                <File size={20} className="file-icon" />
                                            </div>
                                        )}

                                        {/* Size Badge */}
                                        {!file.is_dir && file.original_size !== undefined && (
                                            <div
                                                className={`badge-size ${file.original_size >= FAT32_LIMIT ? 'badge-size-red' : 'badge-size-green'}`}
                                                style={{ marginRight: '0.75rem', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}
                                            >
                                                {formatBytes(file.original_size)}
                                            </div>
                                        )}

                                        <div
                                            className="file-name-container"
                                            onClick={() => file.is_dir ? handleFolderClick(file.name) : toggleExpand(file.name)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <span
                                                className={`file-name ${!file.is_dir && expandedFiles[file.name] ? 'expanded' : ''}`}
                                                title={file.name}
                                            >
                                                {file.name}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="file-meta">
                                        {/* Status Badge */}
                                        {file.status === 'SPLIT' && (
                                            <span className="badge badge-split-yes">
                                                SPLIT {file.rar_parts > 0 && `(${file.rar_parts} ${file.rar_parts === 1 ? 'part' : 'parts'})`}
                                            </span>
                                        )}
                                        {file.status === 'PARTIAL' && (
                                            <span className="badge badge-split-warning">
                                                PARTIAL {file.rar_parts > 0 && `(${file.rar_parts} ${file.rar_parts === 1 ? 'part' : 'parts'})`}
                                            </span>
                                        )}

                                        {!file.is_dir && (file.status === 'SPLIT' || file.status === 'PARTIAL') && (
                                            <button
                                                className="btn-icon btn-delete"
                                                onClick={(e) => confirmDelete(e, file)}
                                                title="Delete RARs"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                        {files.length === 0 && (
                            <div className="empty-state">No files found</div>
                        )}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default FileBrowser;
