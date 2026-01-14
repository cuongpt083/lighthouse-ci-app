/**
 * @license Copyright 2026 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const { Sequelize } = require('sequelize');

/**
 * Migration to add monitored_pages table for web performance monitoring
 * This table stores configuration for pages that should be monitored on a schedule
 */

module.exports = {
    /**
     * @param {{queryInterface: import('sequelize').QueryInterface, options: LHCI.ServerCommand.StorageOptions}} context
     */
    async up(context) {
        const { queryInterface } = context;
        const transaction = await queryInterface.sequelize.transaction();

        try {
            await queryInterface.createTable(
                'monitored_pages',
                {
                    id: {
                        type: Sequelize.UUID,
                        primaryKey: true,
                        allowNull: false,
                    },
                    projectId: {
                        type: Sequelize.UUID,
                        allowNull: false,
                        references: {
                            model: 'projects',
                            key: 'id',
                        },
                        onUpdate: 'CASCADE',
                        onDelete: 'CASCADE',
                    },
                    url: {
                        type: Sequelize.STRING(512),
                        allowNull: false,
                    },
                    label: {
                        type: Sequelize.STRING(255),
                        allowNull: false,
                    },
                    description: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },
                    schedule: {
                        type: Sequelize.STRING(100),
                        allowNull: false,
                        defaultValue: '0 */6 * * *', // Every 6 hours by default
                    },
                    enabled: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: true,
                    },
                    lighthouseConfig: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                        comment: 'JSON string containing custom Lighthouse configuration',
                    },
                    lastRunAt: {
                        type: Sequelize.DATE,
                        allowNull: true,
                    },
                    nextRunAt: {
                        type: Sequelize.DATE,
                        allowNull: true,
                    },
                    createdAt: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                    updatedAt: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                },
                { transaction }
            );

            // Add indexes for better query performance
            await queryInterface.addIndex('monitored_pages', ['projectId'], {
                name: 'monitored_pages_project_id',
                transaction,
            });

            await queryInterface.addIndex('monitored_pages', ['enabled'], {
                name: 'monitored_pages_enabled',
                transaction,
            });

            await queryInterface.addIndex('monitored_pages', ['nextRunAt'], {
                name: 'monitored_pages_next_run_at',
                transaction,
            });

            // Composite index for common queries
            await queryInterface.addIndex('monitored_pages', ['projectId', 'enabled'], {
                name: 'monitored_pages_project_enabled',
                transaction,
            });

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    },

    /**
     * @param {{queryInterface: import('sequelize').QueryInterface}} context
     */
    async down(context) {
        const { queryInterface } = context;
        const transaction = await queryInterface.sequelize.transaction();

        try {
            // Drop indexes first
            await queryInterface.removeIndex('monitored_pages', 'monitored_pages_project_id', {
                transaction,
            });
            await queryInterface.removeIndex('monitored_pages', 'monitored_pages_enabled', {
                transaction,
            });
            await queryInterface.removeIndex('monitored_pages', 'monitored_pages_next_run_at', {
                transaction,
            });
            await queryInterface.removeIndex('monitored_pages', 'monitored_pages_project_enabled', {
                transaction,
            });

            // Drop table
            await queryInterface.dropTable('monitored_pages', { transaction });

            await transaction.commit();
        } catch (err) {
            await transaction.rollback();
            throw err;
        }
    },
};
