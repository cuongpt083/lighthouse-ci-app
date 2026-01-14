/**
 * @license Copyright 2026 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const { CronJob } = require('cron');
const { runLighthouseForPage } = require('./lighthouse-monitor.js');

/**
 * MonitorScheduler manages cron jobs for monitoring pages
 * Dynamically schedules/unschedules pages based on database configuration
 */
class MonitorScheduler {
    /**
     * @param {LHCI.ServerCommand.StorageMethod} storageMethod
     * @param {Object} options
     * @param {string} [options.logLevel='verbose']
     */
    constructor(storageMethod, options = {}) {
        this.storageMethod = storageMethod;
        this.options = options;

        /** @type {Map<string, CronJob>} Map of pageId to CronJob */
        this.jobs = new Map();

        /** @type {Set<string>} Set of pageIds currently running */
        this.runningJobs = new Set();

        this.initialized = false;
    }

    /**
     * Initialize scheduler with all enabled pages from database
     * @return {Promise<void>}
     */
    async initialize() {
        if (this.initialized) {
            this.log('Scheduler already initialized');
            return;
        }

        this.log('Initializing monitor scheduler...');

        try {
            const pages = await this.storageMethod.getEnabledMonitoredPages();

            this.log(`Found ${pages.length} enabled monitored pages`);

            for (const page of pages) {
                try {
                    this.schedulePageMonitoring(page);
                } catch (err) {
                    this.log(`Failed to schedule page ${page.id}: ${err.message}`);
                }
            }

            this.initialized = true;
            this.log(`Monitor scheduler initialized with ${this.jobs.size} active schedules`);
        } catch (err) {
            this.log(`Failed to initialize scheduler: ${err.message}`);
            throw err;
        }
    }

    /**
     * Schedule monitoring for a specific page
     * @param {LHCI.ServerCommand.MonitoredPage} page
     */
    schedulePageMonitoring(page) {
        // Remove existing job if any
        this.unschedulePageMonitoring(page.id);

        if (!page.enabled) {
            this.log(`Page "${page.label}" is disabled, skipping schedule`);
            return;
        }

        try {
            // Validate cron schedule
            const job = new CronJob(
                page.schedule,
                async () => {
                    await this.executeMonitoring(page);
                },
                null, // onComplete
                false, // start
                'UTC' // timezone
            );

            this.jobs.set(page.id, job);
            job.start();

            const nextRun = job.nextDate().toDate();
            this.log(`Scheduled monitoring for "${page.label}" (${page.url})`);
            this.log(`  Schedule: ${page.schedule}`);
            this.log(`  Next run: ${nextRun.toISOString()}`);
        } catch (err) {
            this.log(`Failed to schedule page "${page.label}": ${err.message}`);
            throw err;
        }
    }

    /**
     * Unschedule monitoring for a specific page
     * @param {string} pageId
     */
    unschedulePageMonitoring(pageId) {
        const job = this.jobs.get(pageId);
        if (job) {
            job.stop();
            this.jobs.delete(pageId);
            this.log(`Unscheduled monitoring for page ${pageId}`);
        }
    }

    /**
     * Execute monitoring for a page
     * @param {LHCI.ServerCommand.MonitoredPage} page
     * @return {Promise<void>}
     */
    async executeMonitoring(page) {
        // Prevent concurrent runs for the same page
        if (this.runningJobs.has(page.id)) {
            this.log(`Monitoring for "${page.label}" already running, skipping...`);
            return;
        }

        this.runningJobs.add(page.id);
        const startTime = Date.now();

        this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.log(`Starting monitoring: "${page.label}"`);
        this.log(`URL: ${page.url}`);
        this.log(`Time: ${new Date().toISOString()}`);
        this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        try {
            // Get fresh page data from database (in case it was updated)
            const freshPage = await this.storageMethod.getMonitoredPage(page.projectId, page.id);
            if (!freshPage) {
                this.log(`Page ${page.id} not found in database, unscheduling...`);
                this.unschedulePageMonitoring(page.id);
                return;
            }

            if (!freshPage.enabled) {
                this.log(`Page "${page.label}" is now disabled, unscheduling...`);
                this.unschedulePageMonitoring(page.id);
                return;
            }

            // Get project
            const project = await this.storageMethod.findProjectById(freshPage.projectId);
            if (!project) {
                this.log(`Project ${freshPage.projectId} not found`);
                return;
            }

            // Run Lighthouse monitoring
            const build = await runLighthouseForPage(
                this.storageMethod,
                freshPage,
                project,
                {
                    numberOfRuns: 3,
                    log: (msg) => this.log(`  ${msg}`),
                }
            );

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            this.log(`✅ Monitoring completed successfully`);
            this.log(`   Build ID: ${build.id}`);
            this.log(`   Duration: ${duration}s`);
            this.log(`   Next run: ${freshPage.nextRunAt || 'Not scheduled'}`);

        } catch (err) {
            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            this.log(`❌ Monitoring failed for "${page.label}"`);
            this.log(`   Error: ${err.message}`);
            this.log(`   Duration: ${duration}s`);

            // Don't unschedule on failure - will retry on next schedule
        } finally {
            this.runningJobs.delete(page.id);
            this.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }
    }

    /**
     * Trigger immediate monitoring run for a page (bypass schedule)
     * @param {string} pageId
     * @return {Promise<void>}
     */
    async triggerImmediateRun(pageId) {
        this.log(`Manual trigger requested for page ${pageId}`);

        // Get page from database
        const pages = await this.storageMethod.getEnabledMonitoredPages();
        const page = pages.find(p => p.id === pageId);

        if (!page) {
            // Try to get disabled page too
            const allPages = await this.storageMethod.getMonitoredPages(pageId);
            const disabledPage = allPages.find(p => p.id === pageId);

            if (disabledPage) {
                throw new Error(`Page "${disabledPage.label}" is disabled`);
            }
            throw new Error('Page not found');
        }

        await this.executeMonitoring(page);
    }

    /**
     * Reload all schedules from database
     * Useful after bulk updates or database changes
     * @return {Promise<void>}
     */
    async reloadSchedules() {
        this.log('Reloading all schedules from database...');

        // Stop all existing jobs
        for (const [pageId, job] of this.jobs.entries()) {
            job.stop();
            this.log(`Stopped job for page ${pageId}`);
        }
        this.jobs.clear();

        // Reinitialize
        this.initialized = false;
        await this.initialize();

        this.log('All schedules reloaded successfully');
    }

    /**
     * Get status of all scheduled jobs
     * @return {Array<{pageId: string, nextRun: string, isRunning: boolean}>}
     */
    getStatus() {
        const status = [];

        for (const [pageId, job] of this.jobs.entries()) {
            status.push({
                pageId,
                nextRun: job.nextDate().toDate().toISOString(),
                isRunning: this.runningJobs.has(pageId),
            });
        }

        return status;
    }

    /**
     * Stop all jobs and cleanup
     * @return {Promise<void>}
     */
    async shutdown() {
        this.log('Shutting down monitor scheduler...');

        // Wait for running jobs to complete (with timeout)
        const timeout = 60000; // 60 seconds
        const startTime = Date.now();

        while (this.runningJobs.size > 0 && (Date.now() - startTime) < timeout) {
            this.log(`Waiting for ${this.runningJobs.size} running jobs to complete...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.runningJobs.size > 0) {
            this.log(`Warning: ${this.runningJobs.size} jobs still running after timeout`);
        }

        // Stop all cron jobs
        for (const [pageId, job] of this.jobs.entries()) {
            job.stop();
        }
        this.jobs.clear();

        this.initialized = false;
        this.log('Monitor scheduler shut down');
    }

    /**
     * Log message if not in silent mode
     * @param {string} message
     */
    log(message) {
        if (this.options.logLevel !== 'silent') {
            const timestamp = new Date().toISOString();
            process.stdout.write(`${timestamp} - [Monitor] ${message}\n`);
        }
    }
}

module.exports = { MonitorScheduler };
