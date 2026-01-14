/**
 * @license Copyright 2026 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const { getGravatarUrlFromEmail } = require('@lhci/utils/src/build-context');

/**
 * Calculate next run time based on cron schedule
 * @param {string} cronSchedule - Cron expression (e.g., "0 */6 * * * ")
    * @return { Date }
        */
function calculateNextRun(cronSchedule) {
    const { CronJob } = require('cron');
    const job = new CronJob(cronSchedule, () => { });
    return job.nextDate().toDate();
}

/**
 * Run Lighthouse for a monitored page
 * This function runs Lighthouse multiple times and stores results
 * 
 * @param {LHCI.ServerCommand.StorageMethod} storageMethod
 * @param {LHCI.ServerCommand.MonitoredPage} page
 * @param {LHCI.ServerCommand.Project} project
 * @param {Object} options
 * @param {number} [options.numberOfRuns=3] - Number of Lighthouse runs
 * @return {Promise<LHCI.ServerCommand.Build>}
 */
async function runLighthouseForPage(storageMethod, page, project, options = {}) {
    const numberOfRuns = options.numberOfRuns || 3;
    const log = options.log || (() => { });

    log(`Starting Lighthouse monitoring for "${page.label}" (${page.url})`);

    // Create build for this monitoring run
    const build = await storageMethod.createBuild({
        projectId: project.id,
        lifecycle: 'unsealed',
        branch: project.baseBranch,
        externalBuildUrl: page.url,
        commitMessage: `Auto-monitor: ${page.label} at ${new Date().toLocaleString()}`,
        author: 'Lighthouse Monitor <monitor@example.com>',
        avatarUrl: getGravatarUrlFromEmail('monitor@example.com'),
        hash: `monitor-${Date.now().toString(16)}`,
        runAt: new Date().toISOString(),
        committedAt: new Date().toISOString(),
    });

    log(`Created build ${build.id} for monitoring run`);

    // Get Lighthouse configuration
    const lighthouseConfig = page.lighthouseConfig || {};

    // Run Lighthouse multiple times
    let successfulRuns = 0;
    for (let i = 0; i < numberOfRuns; i++) {
        try {
            log(`Running Lighthouse iteration ${i + 1}/${numberOfRuns} for ${page.url}`);

            const lhr = await runLighthouse(page.url, lighthouseConfig, options);

            await storageMethod.createRun({
                projectId: project.id,
                buildId: build.id,
                representative: false,
                url: page.url,
                lhr: JSON.stringify(lhr),
            });

            successfulRuns++;
            log(`Completed iteration ${i + 1}/${numberOfRuns}`);

            // Small delay between runs to avoid rate limiting
            if (i < numberOfRuns - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        } catch (err) {
            log(`Lighthouse run ${i + 1} failed: ${err.message}`);
            // Continue with other runs even if one fails
        }
    }

    if (successfulRuns === 0) {
        throw new Error(`All ${numberOfRuns} Lighthouse runs failed for ${page.url}`);
    }

    log(`Completed ${successfulRuns}/${numberOfRuns} successful runs`);

    // Seal the build (this will calculate statistics)
    await storageMethod.sealBuild(build.projectId, build.id);
    log(`Build sealed and statistics calculated`);

    // Update page's last run time and calculate next run
    await storageMethod.updateMonitoredPage(page.id, {
        lastRunAt: new Date().toISOString(),
        nextRunAt: calculateNextRun(page.schedule).toISOString(),
    });

    log(`Updated page timestamps - next run: ${calculateNextRun(page.schedule).toISOString()}`);

    return build;
}

/**
 * Run Lighthouse using the CLI package
 * @param {string} url - URL to audit
 * @param {Object} config - Lighthouse configuration
 * @param {Object} options - Additional options
 * @return {Promise<LH.Result>}
 */
async function runLighthouse(url, config = {}, options = {}) {
    const log = options.log || (() => { });

    try {
        // Use Lighthouse programmatically
        const lighthouse = require('lighthouse');
        const chromeLauncher = require('chrome-launcher');

        log(`Launching Chrome for ${url}`);

        // Launch Chrome
        const chrome = await chromeLauncher.launch({
            chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu'],
        });

        const lighthouseOptions = {
            logLevel: 'error',
            output: 'json',
            port: chrome.port,
            ...config,
        };

        log(`Running Lighthouse audit...`);

        // Run Lighthouse
        const runnerResult = await lighthouse(url, lighthouseOptions);

        // Clean up
        await chrome.kill();

        if (!runnerResult || !runnerResult.lhr) {
            throw new Error('Lighthouse did not return a valid report');
        }

        log(`Lighthouse audit completed successfully`);

        return runnerResult.lhr;
    } catch (err) {
        log(`Lighthouse execution failed: ${err.message}`);
        throw new Error(`Failed to run Lighthouse for ${url}: ${err.message}`);
    }
}

module.exports = {
    runLighthouseForPage,
    runLighthouse,
    calculateNextRun,
};
