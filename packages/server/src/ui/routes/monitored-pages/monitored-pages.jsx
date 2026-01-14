/**
 * @license Copyright 2026 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import { h, Fragment } from 'preact';
import { useState } from 'preact/hooks';
import {
    useMonitoredPages,
    createMonitoredPage,
    updateMonitoredPage,
    deleteMonitoredPage,
    triggerMonitorRun,
} from '../../hooks/use-monitored-pages.js';
import { AsyncLoader } from '../../components/async-loader.jsx';
import { Page } from '../../layout/page.jsx';
import { DocumentTitle } from '../../components/document-title.jsx';
import './monitored-pages.css';

const SCHEDULE_PRESETS = [
    { label: 'Every Hour', value: '0 * * * *' },
    { label: 'Every 6 Hours', value: '0 */6 * * *' },
    { label: 'Every 12 Hours', value: '0 */12 * * *' },
    { label: 'Daily at 2 AM', value: '0 2 * * *' },
    { label: 'Weekly (Monday 2 AM)', value: '0 2 * * 1' },
    { label: 'Custom', value: 'custom' },
];

/** @param {{project: LHCI.ServerCommand.Project}} props */
export const MonitoredPages = props => {
    const { project } = props;
    const [loadingState, pages, setPages] = useMonitoredPages(project.id);
    const [selectedPage, setSelectedPage] = useState(null);
    const [adminToken, setAdminToken] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);
    const [notification, setNotification] = useState(null);

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleDelete = async pageId => {
        if (!confirm('Are you sure you want to delete this monitored page?')) return;

        if (!adminToken) {
            setShowTokenInput(true);
            showNotification('Admin token required', 'error');
            return;
        }

        try {
            await deleteMonitoredPage(project.id, pageId, adminToken);
            setPages(pages.filter(p => p.id !== pageId));
            showNotification('Page deleted successfully');
        } catch (err) {
            showNotification(`Failed to delete: ${err.message}`, 'error');
        }
    };

    const handleTrigger = async pageId => {
        if (!adminToken) {
            setShowTokenInput(true);
            showNotification('Admin token required', 'error');
            return;
        }

        try {
            showNotification('Triggering monitoring run...', 'info');
            await triggerMonitorRun(project.id, pageId, adminToken);
            showNotification('Monitoring run triggered successfully!');
        } catch (err) {
            showNotification(`Failed to trigger: ${err.message}`, 'error');
        }
    };

    const handleSave = async pageData => {
        if (!adminToken) {
            setShowTokenInput(true);
            showNotification('Admin token required', 'error');
            return;
        }

        try {
            if (selectedPage && selectedPage.id) {
                // Update existing
                await updateMonitoredPage(project.id, selectedPage.id, pageData, adminToken);
                setPages(pages.map(p => (p.id === selectedPage.id ? { ...p, ...pageData } : p)));
                showNotification('Page updated successfully');
            } else {
                // Create new
                const newPage = await createMonitoredPage(project.id, pageData, adminToken);
                setPages([newPage, ...pages]);
                showNotification('Page created successfully');
            }
            setSelectedPage(null);
        } catch (err) {
            showNotification(`Failed to save: ${err.message}`, 'error');
        }
    };

    return (
        <Page>
            <DocumentTitle title={`${project.name} - Monitored Pages`} />

            <div className="monitored-pages">
                <div className="monitored-pages__header">
                    <div>
                        <h1>Monitored Pages</h1>
                        <p className="monitored-pages__subtitle">
                            Configure pages to monitor automatically with Lighthouse
                        </p>
                    </div>
                    <div className="monitored-pages__actions">
                        {!showTokenInput && (
                            <button
                                className="button button--secondary"
                                onClick={() => setShowTokenInput(true)}
                            >
                                🔑 Set Admin Token
                            </button>
                        )}
                        <button
                            className="button button--primary"
                            onClick={() => setSelectedPage({})}
                        >
                            + Add Page
                        </button>
                    </div>
                </div>

                {showTokenInput && (
                    <div className="token-input-card">
                        <label>
                            Admin Token:
                            <input
                                type="password"
                                value={adminToken}
                                onChange={e => setAdminToken(e.target.value)}
                                placeholder="Enter admin token for this project"
                            />
                        </label>
                        <button onClick={() => setShowTokenInput(false)}>Done</button>
                    </div>
                )}

                {notification && (
                    <div className={`notification notification--${notification.type}`}>
                        {notification.message}
                    </div>
                )}

                <AsyncLoader
                    loadingState={loadingState}
                    asyncData={[pages]}
                    render={([pagesData]) => (
                        <PageList
                            pages={pagesData}
                            onEdit={setSelectedPage}
                            onDelete={handleDelete}
                            onTrigger={handleTrigger}
                        />
                    )}
                />

                {selectedPage && (
                    <PageFormModal
                        page={selectedPage}
                        onClose={() => setSelectedPage(null)}
                        onSave={handleSave}
                    />
                )}
            </div>
        </Page>
    );
};

/** @param {{pages: Array, onEdit: Function, onDelete: Function, onTrigger: Function}} props */
const PageList = ({ pages, onEdit, onDelete, onTrigger }) => {
    if (pages.length === 0) {
        return (
            <div className="empty-state">
                <h2>No monitored pages yet</h2>
                <p>Add your first page to start automated performance monitoring</p>
            </div>
        );
    }

    return (
        <div className="page-list">
            <table className="page-table">
                <thead>
                    <tr>
                        <th>Label</th>
                        <th>URL</th>
                        <th>Schedule</th>
                        <th>Last Run</th>
                        <th>Next Run</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {pages.map(page => (
                        <tr key={page.id}>
                            <td className="page-table__label">{page.label}</td>
                            <td className="page-table__url">
                                <a href={page.url} target="_blank" rel="noopener noreferrer">
                                    {page.url}
                                </a>
                            </td>
                            <td className="page-table__schedule">{page.schedule}</td>
                            <td className="page-table__time">
                                {page.lastRunAt ? formatDate(page.lastRunAt) : 'Never'}
                            </td>
                            <td className="page-table__time">
                                {page.nextRunAt ? formatDate(page.nextRunAt) : '-'}
                            </td>
                            <td>
                                <span className={`status-badge status-badge--${page.enabled ? 'enabled' : 'disabled'}`}>
                                    {page.enabled ? 'Enabled' : 'Disabled'}
                                </span>
                            </td>
                            <td className="page-table__actions">
                                <button
                                    className="button button--small"
                                    onClick={() => onEdit(page)}
                                    title="Edit"
                                >
                                    ✏️
                                </button>
                                <button
                                    className="button button--small button--primary"
                                    onClick={() => onTrigger(page.id)}
                                    title="Run Now"
                                >
                                    ▶️
                                </button>
                                <button
                                    className="button button--small button--danger"
                                    onClick={() => onDelete(page.id)}
                                    title="Delete"
                                >
                                    🗑️
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

/** @param {{page: any, onClose: Function, onSave: Function}} props */
const PageFormModal = ({ page, onClose, onSave }) => {
    const isEdit = !!page.id;
    const [formData, setFormData] = useState({
        url: page.url || '',
        label: page.label || '',
        description: page.description || '',
        schedule: page.schedule || '0 */6 * * *',
        enabled: page.enabled !== undefined ? page.enabled : true,
    });

    const [schedulePreset, setSchedulePreset] = useState(() => {
        const preset = SCHEDULE_PRESETS.find(p => p.value === formData.schedule);
        return preset ? preset.value : 'custom';
    });

    const handleSubmit = e => {
        e.preventDefault();
        onSave(formData);
    };

    const handlePresetChange = value => {
        setSchedulePreset(value);
        if (value !== 'custom') {
            setFormData({ ...formData, schedule: value });
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal__header">
                    <h2>{isEdit ? 'Edit' : 'Add'} Monitored Page</h2>
                    <button className="modal__close" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal__form">
                    <div className="form-group">
                        <label>
                            Label *
                            <input
                                type="text"
                                value={formData.label}
                                onChange={e => setFormData({ ...formData, label: e.target.value })}
                                placeholder="e.g., Homepage"
                                required
                            />
                        </label>
                    </div>

                    <div className="form-group">
                        <label>
                            URL *
                            <input
                                type="url"
                                value={formData.url}
                                onChange={e => setFormData({ ...formData, url: e.target.value })}
                                placeholder="https://example.com"
                                required
                            />
                        </label>
                    </div>

                    <div className="form-group">
                        <label>
                            Description
                            <textarea
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Optional description"
                                rows="3"
                            />
                        </label>
                    </div>

                    <div className="form-group">
                        <label>
                            Schedule Preset
                            <select value={schedulePreset} onChange={e => handlePresetChange(e.target.value)}>
                                {SCHEDULE_PRESETS.map(preset => (
                                    <option key={preset.value} value={preset.value}>
                                        {preset.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {schedulePreset === 'custom' && (
                        <div className="form-group">
                            <label>
                                Cron Expression
                                <input
                                    type="text"
                                    value={formData.schedule}
                                    onChange={e => setFormData({ ...formData, schedule: e.target.value })}
                                    placeholder="0 */6 * * *"
                                />
                            </label>
                            <small className="form-help">
                                Format: minute hour day month weekday (e.g., "0 */6 * * *" = every 6 hours)
                            </small>
                        </div>
                    )}

                    <div className="form-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={formData.enabled}
                                onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                            />
                            Enabled
                        </label>
                    </div>

                    <div className="modal__actions">
                        <button type="button" className="button" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="button button--primary">
                            {isEdit ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
}
