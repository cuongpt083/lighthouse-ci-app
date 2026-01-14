/**
 * @license Copyright 2026 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

const { DataTypes } = require('sequelize');

/**
 * @type {LHCI.ServerCommand.TableDefinition<LHCI.ServerCommand.MonitoredPage>}
 */
module.exports = {
    tableName: 'monitored_pages',
    attributes: {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            allowNull: false,
        },
        projectId: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: undefined, // Will be set during initialization in sql.js
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        url: {
            type: DataTypes.STRING(512),
            allowNull: false,
            validate: {
                isUrl: true,
            },
        },
        label: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [1, 255],
            },
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        schedule: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: '0 */6 * * *',
            validate: {
                notEmpty: true,
            },
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        lighthouseConfig: {
            type: DataTypes.TEXT,
            allowNull: true,
            get() {
                const rawValue = this.getDataValue('lighthouseConfig');
                if (!rawValue) return null;
                try {
                    return JSON.parse(rawValue);
                } catch (err) {
                    return null;
                }
            },
            set(value) {
                if (value === null || value === undefined) {
                    this.setDataValue('lighthouseConfig', null);
                } else {
                    this.setDataValue('lighthouseConfig', JSON.stringify(value));
                }
            },
        },
        lastRunAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        nextRunAt: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    },
};
