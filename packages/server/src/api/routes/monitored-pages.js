/**
 * @license Copyright 2026 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const express = require('express');
const {
    handleAsyncError,
    validateAdminTokenMiddleware,
    E422,
} = require('../express-utils.js');

/**
 * @param {{storageMethod: LHCI.ServerCommand.StorageMethod, monitorScheduler?: any, triggerMonitorRun?: Function}} context
 * @return {import('express').Router}
 */
function createMonitoredPagesRouter(context) {
    const router = express.Router();

    // GET /v1/projects/:projectId/monitored-pages
    // List all monitored pages for a project
    router.get(
        '/:projectId/monitored-pages',
        handleAsyncError(async (req, res) => {
            const pages = await context.storageMethod.getMonitoredPages(req.params.projectId);
            res.json(pages);
        })
    );

    // GET /v1/projects/:projectId/monitored-pages/:pageId
    // Get a single monitored page
    router.get(
        '/:projectId/monitored-pages/:pageId',
        handleAsyncError(async (req, res) => {
            const page = await context.storageMethod.getMonitoredPage(
                req.params.projectId,
                req.params.pageId
            );
            if (!page) return res.sendStatus(404);
            res.json(page);
        })
    );

    // POST /v1/projects/:projectId/monitored-pages
    // Create a new monitored page (requires admin token)
    router.post(
        '/:projectId/monitored-pages',
        validateAdminTokenMiddleware(context),
        handleAsyncError(async (req, res) => {
            const unsavedPage = {
                ...req.body,
                projectId: req.params.projectId,
            };

            // Validate required fields
            if (!unsavedPage.url) {
                throw new E422('URL is required');
            }
            if (!unsavedPage.label) {
                throw new E422('Label is required');
            }

            // Validate URL format
            try {
                new URL(unsavedPage.url);
            } catch (err) {
                throw new E422('Invalid URL format');
            }

            // Validate schedule if provided
            if (unsavedPage.schedule) {
                // Basic cron validation (5 or 6 parts)
                const cronParts = unsavedPage.schedule.trim().split(/\s+/);
                if (cronParts.length < 5 || cronParts.length > 6) {
                    throw new E422('Invalid cron schedule format');
                }
            }

            const page = await context.storageMethod.createMonitoredPage(unsavedPage);

            // If monitor scheduler is available, schedule the new page
            if (context.monitorScheduler && page.enabled) {
                try {
                    context.monitorScheduler.schedulePageMonitoring(page);
                } catch (err) {
                    // Log error but don't fail the request
                    console.error('Failed to schedule monitoring:', err);
                }
            }

            res.status(201).json(page);
        })
    );

    // PUT /v1/projects/:projectId/monitored-pages/:pageId
    // Update a monitored page (requires admin token)
    router.put(
        '/:projectId/monitored-pages/:pageId',
        validateAdminTokenMiddleware(context),
        handleAsyncError(async (req, res) => {
            const { projectId, pageId } = req.params;

            // Verify page exists and belongs to project
            const existingPage = await context.storageMethod.getMonitoredPage(projectId, pageId);
            if (!existingPage) {
                return res.sendStatus(404);
            }

            // Validate URL if being updated
            if (req.body.url) {
                try {
                    new URL(req.body.url);
                } catch (err) {
                    throw new E422('Invalid URL format');
                }
            }

            // Validate schedule if being updated
            if (req.body.schedule) {
                const cronParts = req.body.schedule.trim().split(/\s+/);
                if (cronParts.length < 5 || cronParts.length > 6) {
                    throw new E422('Invalid cron schedule format');
                }
            }

            await context.storageMethod.updateMonitoredPage(pageId, req.body);

            // If schedule or enabled status changed, update scheduler
            if (context.monitorScheduler && (req.body.schedule || req.body.enabled !== undefined)) {
                try {
                    const updatedPage = await context.storageMethod.getMonitoredPage(projectId, pageId);
                    if (updatedPage) {
                        if (updatedPage.enabled) {
                            context.monitorScheduler.schedulePageMonitoring(updatedPage);
                        } else {
                            context.monitorScheduler.unschedulePageMonitoring(pageId);
                        }
                    }
                } catch (err) {
                    console.error('Failed to update schedule:', err);
                }
            }

            res.sendStatus(204);
        })
    );

    // DELETE /v1/projects/:projectId/monitored-pages/:pageId
    // Delete a monitored page (requires admin token)
    router.delete(
        '/:projectId/monitored-pages/:pageId',
        validateAdminTokenMiddleware(context),
        handleAsyncError(async (req, res) => {
            const { projectId, pageId } = req.params;

            // Unschedule before deleting
            if (context.monitorScheduler) {
                try {
                    context.monitorScheduler.unschedulePageMonitoring(pageId);
                } catch (err) {
                    console.error('Failed to unschedule monitoring:', err);
                }
            }

            await context.storageMethod.deleteMonitoredPage(projectId, pageId);
            res.sendStatus(204);
        })
    );

    // POST /v1/projects/:projectId/monitored-pages/:pageId/trigger
    // Manually trigger a monitoring run (requires admin token)
    router.post(
        '/:projectId/monitored-pages/:pageId/trigger',
        validateAdminTokenMiddleware(context),
        handleAsyncError(async (req, res) => {
            const { projectId, pageId } = req.params;

            const page = await context.storageMethod.getMonitoredPage(projectId, pageId);
            if (!page) {
                return res.sendStatus(404);
            }

            // Trigger immediate run
            if (context.triggerMonitorRun) {
                try {
                    await context.triggerMonitorRun(page);
                    res.json({
                        message: 'Monitoring run triggered successfully',
                        pageId: page.id,
                        url: page.url,
                    });
                } catch (err) {
                    throw new E422(`Failed to trigger monitoring run: ${err.message}`);
                }
            } else {
                throw new E422('Monitor scheduler not available');
            }
        })
    );

    // POST /v1/projects/:projectId/monitored-pages/reload-schedules
    // Reload all schedules from database (requires admin token)
    router.post(
        '/:projectId/monitored-pages/reload-schedules',
        validateAdminTokenMiddleware(context),
        handleAsyncError(async (req, res) => {
            if (context.monitorScheduler) {
                try {
                    await context.monitorScheduler.reloadSchedules();
                    res.json({ message: 'Schedules reloaded successfully' });
                } catch (err) {
                    throw new E422(`Failed to reload schedules: ${err.message}`);
                }
            } else {
                throw new E422('Monitor scheduler not available');
            }
        })
    );

    return router;
}

module.exports = createMonitoredPagesRouter;
