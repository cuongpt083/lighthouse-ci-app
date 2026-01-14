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
 * Run Lighthouse using the CLI package with custom User-Agent
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

        // Custom User-Agent to avoid bot detection
        const customUserAgent = config.userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LighthouseCI/1.0';

        // Launch Chrome with custom flags
        const chrome = await chromeLauncher.launch({
            chromeFlags: [
                '--headless',
                '--no-sandbox',
                '--disable-gpu',
                '--disable-dev-shm-usage',
                '--disable-setuid-sandbox',
                // Custom User-Agent to bypass bot detection
                `--user-agent=${customUserAgent}`,
                // Additional flags to appear more like a real browser
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
            ],
        });

        const lighthouseOptions = {
            logLevel: 'error',
            output: 'json',
            port: chrome.port,
            // Add custom headers if provided
            extraHeaders: config.extraHeaders || {},
            ...config,
        };

        log(`Running Lighthouse audit with custom User-Agent...`);

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
        // Enhanced error logging with firewall/WAF detection
        log(`❌ Lighthouse execution failed: ${err.message}`);

        // Detect common blocking scenarios
        if (err.message.includes('403') || err.message.includes('Forbidden')) {
            log(`⚠️  HTTP 403 Forbidden - Possible firewall/WAF blocking`);
            log(`   → Check IP whitelist or contact site administrator`);
        } else if (err.message.includes('429') || err.message.includes('Too Many Requests')) {
            log(`⚠️  HTTP 429 Rate Limiting - Too many requests`);
            log(`   → Reduce monitoring frequency or add delays between runs`);
        } else if (err.message.includes('timeout') || err.message.includes('Navigation timeout')) {
            log(`⚠️  Timeout - Possible CAPTCHA challenge or slow response`);
            log(`   → Site may be blocking headless browsers`);
        } else if (err.message.includes('ERR_CONNECTION_REFUSED')) {
            log(`⚠️  Connection refused - Site may be blocking this IP`);
        } else if (err.message.includes('ERR_NAME_NOT_RESOLVED')) {
            log(`⚠️  DNS resolution failed - Check URL or network connectivity`);
        }

        throw new Error(`Failed to run Lighthouse for ${url}: ${err.message}`);
    }
}

/**
 * Run Lighthouse with retry logic for transient failures
 * @param {string} url - URL to audit
 * @param {Object} config - Lighthouse configuration
 * @param {Object} options - Additional options
 * @param {number} maxRetries - Maximum number of retry attempts
 * @return {Promise<LH.Result>}
 */
async function runLighthouseWithRetry(url, config = {}, options = {}, maxRetries = 3) {
    const log = options.log || (() => { });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 1) {
                log(`Retry attempt ${attempt}/${maxRetries} for ${url}`);
            }

            const result = await runLighthouse(url, config, options);

            if (attempt > 1) {
                log(`✅ Retry successful on attempt ${attempt}`);
            }

            return result;
        } catch (err) {
            log(`Attempt ${attempt}/${maxRetries} failed: ${err.message}`);

            // Don't retry on certain errors
            if (err.message.includes('403') || err.message.includes('ERR_NAME_NOT_RESOLVED')) {
                log(`Non-retryable error detected, aborting retries`);
                throw err;
            }

            if (attempt === maxRetries) {
                log(`All ${maxRetries} attempts failed`);
                throw err;
            }

            // Exponential backoff: 2s, 4s, 8s
            const delay = Math.pow(2, attempt) * 1000;
            log(`Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

module.exports = {
    runLighthouseForPage,
    runLighthouse,
    runLighthouseWithRetry,
    calculateNextRun,
};
