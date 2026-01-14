/**
 * @license Copyright 2026 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const { CronJob } = require('cron');

/**
 * Delete builds and runs older than retention period
 * @param {LHCI.ServerCommand.StorageMethod} storageMethod
 * @param {number} retentionDays - Number of days to retain data (default: 30)
 * @return {Promise<{deletedBuilds: number, errors: number}>}
 */
async function cleanupOldData(storageMethod, retentionDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const log = (msg) => {
        process.stdout.write(`${new Date().toISOString()} - [Cleanup] ${msg}\n`);
    };

    log(`Starting cleanup of data older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

    try {
        // Find old builds
        const oldBuilds = await storageMethod.findBuildsBeforeTimestamp(cutoffDate);

        if (oldBuilds.length === 0) {
            log('No old builds found to delete');
            return { deletedBuilds: 0, errors: 0 };
        }

        log(`Found ${oldBuilds.length} builds to delete`);

        let deletedCount = 0;
        let errorCount = 0;

        // Delete builds one by one
        for (const build of oldBuilds) {
            try {
                await storageMethod.deleteBuild(build.projectId, build.id);
                deletedCount++;

                if (deletedCount % 10 === 0) {
                    log(`Progress: ${deletedCount}/${oldBuilds.length} builds deleted`);
                }
            } catch (err) {
                errorCount++;
                log(`Failed to delete build ${build.id}: ${err.message}`);
            }
        }

        log(`Cleanup completed: ${deletedCount} builds deleted, ${errorCount} errors`);

        return {
            deletedBuilds: deletedCount,
            errors: errorCount,
        };
    } catch (err) {
        log(`Cleanup failed: ${err.message}`);
        throw err;
    }
}

/**
 * Start cron job to cleanup old data
 * Runs daily at 2 AM UTC
 * 
 * @param {LHCI.ServerCommand.StorageMethod} storageMethod
 * @param {Object} options
 * @param {number} [options.dataRetentionDays=30] - Days to retain data
 * @param {string} [options.cleanupSchedule='0 2 * * *'] - Cron schedule
 * @param {string} [options.logLevel='verbose']
 * @return {CronJob}
 */
function startCleanupCron(storageMethod, options = {}) {
    const retentionDays = options.dataRetentionDays || 30;
    const schedule = options.cleanupSchedule || '0 2 * * *'; // 2 AM daily

    const log = (msg) => {
        if (options.logLevel !== 'silent') {
            process.stdout.write(`${new Date().toISOString()} - [Cleanup] ${msg}\n`);
        }
    };

    log(`Scheduling daily cleanup with ${retentionDays} days retention`);
    log(`Schedule: ${schedule} (UTC)`);

    const job = new CronJob(
        schedule,
        async () => {
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log('Starting scheduled data cleanup');
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

            try {
                const result = await cleanupOldData(storageMethod, retentionDays);

                log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                log(`Cleanup summary:`);
                log(`  Deleted: ${result.deletedBuilds} builds`);
                log(`  Errors: ${result.errors}`);
                log(`  Retention: ${retentionDays} days`);
                log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            } catch (err) {
                log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                log(`Cleanup failed: ${err.message}`);
                log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
            }
        },
        null, // onComplete
        true, // start immediately
        'UTC' // timezone
    );

    const nextRun = job.nextDate().toDate();
    log(`Cleanup cron started. Next run: ${nextRun.toISOString()}`);

    return job;
}

module.exports = {
    cleanupOldData,
    startCleanupCron,
};
