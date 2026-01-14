/**
 * @license Copyright 2026 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import { useState, useEffect } from 'preact/hooks';

/**
 * Hook to fetch monitored pages for a project
 * @param {string} projectId
 * @return {[string, Array<any>, Function]}
 */
export function useMonitoredPages(projectId) {
    const [loadingState, setLoadingState] = useState('loading');
    const [pages, setPages] = useState([]);

    useEffect(() => {
        if (!projectId) {
            setLoadingState('loaded');
            return;
        }

        setLoadingState('loading');

        fetch(`/v1/projects/${projectId}/monitored-pages`)
            .then(res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
            })
            .then(data => {
                setPages(data);
                setLoadingState('loaded');
            })
            .catch(err => {
                console.error('Failed to fetch monitored pages:', err);
                setLoadingState('error');
            });
    }, [projectId]);

    return [loadingState, pages, setPages];
}

/**
 * Create a new monitored page
 * @param {string} projectId
 * @param {Object} pageData
 * @param {string} adminToken
 * @return {Promise<any>}
 */
export async function createMonitoredPage(projectId, pageData, adminToken) {
    const res = await fetch(`/v1/projects/${projectId}/monitored-pages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-LHCI-Admin-Token': adminToken,
        },
        body: JSON.stringify(pageData),
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || `HTTP ${res.status}`);
    }

    return res.json();
}

/**
 * Update a monitored page
 * @param {string} projectId
 * @param {string} pageId
 * @param {Object} updates
 * @param {string} adminToken
 * @return {Promise<void>}
 */
export async function updateMonitoredPage(projectId, pageId, updates, adminToken) {
    const res = await fetch(`/v1/projects/${projectId}/monitored-pages/${pageId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-LHCI-Admin-Token': adminToken,
        },
        body: JSON.stringify(updates),
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || `HTTP ${res.status}`);
    }
}

/**
 * Delete a monitored page
 * @param {string} projectId
 * @param {string} pageId
 * @param {string} adminToken
 * @return {Promise<void>}
 */
export async function deleteMonitoredPage(projectId, pageId, adminToken) {
    const res = await fetch(`/v1/projects/${projectId}/monitored-pages/${pageId}`, {
        method: 'DELETE',
        headers: {
            'X-LHCI-Admin-Token': adminToken,
        },
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || `HTTP ${res.status}`);
    }
}

/**
 * Trigger manual monitoring run for a page
 * @param {string} projectId
 * @param {string} pageId
 * @param {string} adminToken
 * @return {Promise<any>}
 */
export async function triggerMonitorRun(projectId, pageId, adminToken) {
    const res = await fetch(`/v1/projects/${projectId}/monitored-pages/${pageId}/trigger`, {
        method: 'POST',
        headers: {
            'X-LHCI-Admin-Token': adminToken,
        },
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || `HTTP ${res.status}`);
    }

    return res.json();
}

/**
 * Reload all schedules from database
 * @param {string} projectId
 * @param {string} adminToken
 * @return {Promise<any>}
 */
export async function reloadSchedules(projectId, adminToken) {
    const res = await fetch(`/v1/projects/${projectId}/monitored-pages/reload-schedules`, {
        method: 'POST',
        headers: {
            'X-LHCI-Admin-Token': adminToken,
        },
    });

    if (!res.ok) {
        const error = await res.text();
        throw new Error(error || `HTTP ${res.status}`);
    }

    return res.json();
}
