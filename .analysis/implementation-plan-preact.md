# Kế Hoạch Nâng Cấp Lighthouse CI thành Web Performance Monitor Tool

**Ngày:** 2026-01-14  
**Tech Stack:** Node.js + Express + Preact (giữ nguyên)  
**Thời gian:** 3 ngày làm việc  
**Scope:** Monitor tool với 3 chức năng chính

---

## 📋 YÊU CẦU CHỨC NĂNG

### 1. Quản Lý Danh Sách Web Pages
- CRUD operations cho web pages cần monitor
- Thông tin: URL, label, description, enabled status
- Grouping pages theo categories (optional)

### 2. Quản Lý Lịch Monitor
- Cấu hình schedule cho từng page (cron expression)
- Preset schedules: Hourly, Daily, Weekly
- Enable/Disable scheduling
- Manual trigger (run now)

### 3. Quản Lý Kết Quả Monitor
- Xem kết quả theo từng page
- Timeline view (charts theo thời gian)
- Retention: Tự động xóa data cũ hơn 1 tháng
- Export results (CSV/JSON)

---

## 🎯 ĐÁNH GIÁ KHẢ NĂNG TÁI SỬ DỤNG

### ✅ Có Thể Tái Sử Dụng 100% (Không Cần Thay Đổi)

1. **Database Layer:**
   - ✅ Sequelize ORM setup
   - ✅ Migration system
   - ✅ Models: Project, Build, Run, Statistic
   - ✅ Transaction support

2. **Lighthouse Integration:**
   - ✅ CLI package với Lighthouse core
   - ✅ Run logic với multiple iterations
   - ✅ LHR storage

3. **Frontend Framework:**
   - ✅ Preact + Preact Router
   - ✅ Hooks (useState, useEffect)
   - ✅ Chart components (D3.js, Plotly.js)
   - ✅ UI components (Dropdown, AsyncLoader, etc.)

### 🔧 Cần Mở Rộng (Extension)

1. **Database Schema:**
   - 🔧 Thêm bảng `monitored_pages`
   - 🔧 Thêm retention policy logic

2. **API Layer:**
   - 🔧 Endpoints cho page management
   - 🔧 Endpoints cho schedule management

3. **Cron System:**
   - 🔧 Dynamic cron từ database
   - 🔧 Auto cleanup old data

4. **UI Components:**
   - 🔧 Page management UI
   - 🔧 Schedule configuration UI
   - 🔧 Enhanced dashboard

---

## 📅 KẾ HOẠCH THỰC HIỆN CHI TIẾT

### NGÀY 1: DATABASE & BACKEND API (8 giờ)

#### 🌅 Sáng (4 giờ): Database Schema & Models

**Task 1.1: Tạo Migration cho Monitored Pages (1.5 giờ)**

```javascript
// packages/server/src/api/storage/sql/migrations/20260114-monitored-pages.js

module.exports = {
  up: async ({queryInterface, options}) => {
    await queryInterface.createTable('monitored_pages', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
      },
      projectId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'projects',
          key: 'id',
        },
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
        type: Sequelize.STRING(100), // cron expression
        allowNull: false,
        defaultValue: '0 */6 * * *', // Every 6 hours
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      lighthouseConfig: {
        type: Sequelize.TEXT, // JSON string
        allowNull: true,
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
    });

    await queryInterface.addIndex('monitored_pages', ['projectId']);
    await queryInterface.addIndex('monitored_pages', ['enabled']);
    await queryInterface.addIndex('monitored_pages', ['nextRunAt']);
  },
  
  down: async ({queryInterface}) => {
    await queryInterface.dropTable('monitored_pages');
  },
};
```

**Task 1.2: Tạo Sequelize Model (1 giờ)**

```javascript
// packages/server/src/api/storage/sql/monitored-page-model.js

const {DataTypes} = require('sequelize');

module.exports = {
  tableName: 'monitored_pages',
  attributes: {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: undefined, // Will be set during initialization
        key: 'id',
      },
    },
    url: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    schedule: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: '0 */6 * * *',
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
        const raw = this.getDataValue('lighthouseConfig');
        return raw ? JSON.parse(raw) : null;
      },
      set(value) {
        this.setDataValue('lighthouseConfig', value ? JSON.stringify(value) : null);
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
```

**Task 1.3: Extend Storage Method (1.5 giờ)**

Thêm methods vào `packages/server/src/api/storage/sql/sql.js`:

```javascript
// CRUD for Monitored Pages
async getMonitoredPages(projectId) {
  const {monitoredPageModel} = this._sql();
  const pages = await this._findAll(monitoredPageModel, {
    where: {projectId},
    order: [['createdAt', 'DESC']],
  });
  return clone(pages);
}

async getMonitoredPage(projectId, pageId) {
  const {monitoredPageModel} = this._sql();
  const page = await this._findByPk(monitoredPageModel, pageId);
  if (!page || page.projectId !== projectId) return null;
  return clone(page);
}

async createMonitoredPage(unsavedPage) {
  const {monitoredPageModel} = this._sql();
  const page = await monitoredPageModel.create({
    ...unsavedPage,
    id: uuid.v4(),
  });
  return clone(this._value(page));
}

async updateMonitoredPage(pageId, updates) {
  const {monitoredPageModel} = this._sql();
  await monitoredPageModel.update(updates, {where: {id: pageId}});
}

async deleteMonitoredPage(projectId, pageId) {
  const {monitoredPageModel} = this._sql();
  const page = await this._findByPk(monitoredPageModel, pageId);
  if (!page || page.projectId !== projectId) throw new E422('Invalid page');
  await monitoredPageModel.destroy({where: {id: pageId}});
}

async getEnabledMonitoredPages() {
  const {monitoredPageModel} = this._sql();
  const pages = await this._findAll(monitoredPageModel, {
    where: {enabled: true},
    order: [['nextRunAt', 'ASC']],
  });
  return clone(pages);
}
```

#### 🌆 Chiều (4 giờ): API Endpoints

**Task 1.4: Tạo API Routes (2 giờ)**

```javascript
// packages/server/src/api/routes/monitored-pages.js

const express = require('express');
const {
  handleAsyncError,
  validateAdminTokenMiddleware,
  E422,
} = require('../express-utils.js');

function createRouter(context) {
  const router = express.Router();

  // GET /v1/projects/:projectId/monitored-pages
  router.get(
    '/:projectId/monitored-pages',
    handleAsyncError(async (req, res) => {
      const pages = await context.storageMethod.getMonitoredPages(req.params.projectId);
      res.json(pages);
    })
  );

  // GET /v1/projects/:projectId/monitored-pages/:pageId
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
  router.post(
    '/:projectId/monitored-pages',
    validateAdminTokenMiddleware(context),
    handleAsyncError(async (req, res) => {
      const unsavedPage = {
        ...req.body,
        projectId: req.params.projectId,
      };
      
      // Validate
      if (!unsavedPage.url || !unsavedPage.label) {
        throw new E422('URL and label are required');
      }
      
      const page = await context.storageMethod.createMonitoredPage(unsavedPage);
      res.json(page);
    })
  );

  // PUT /v1/projects/:projectId/monitored-pages/:pageId
  router.put(
    '/:projectId/monitored-pages/:pageId',
    validateAdminTokenMiddleware(context),
    handleAsyncError(async (req, res) => {
      await context.storageMethod.updateMonitoredPage(req.params.pageId, req.body);
      res.sendStatus(204);
    })
  );

  // DELETE /v1/projects/:projectId/monitored-pages/:pageId
  router.delete(
    '/:projectId/monitored-pages/:pageId',
    validateAdminTokenMiddleware(context),
    handleAsyncError(async (req, res) => {
      await context.storageMethod.deleteMonitoredPage(
        req.params.projectId,
        req.params.pageId
      );
      res.sendStatus(204);
    })
  );

  // POST /v1/projects/:projectId/monitored-pages/:pageId/trigger
  // Manual trigger for immediate run
  router.post(
    '/:projectId/monitored-pages/:pageId/trigger',
    validateAdminTokenMiddleware(context),
    handleAsyncError(async (req, res) => {
      const page = await context.storageMethod.getMonitoredPage(
        req.params.projectId,
        req.params.pageId
      );
      if (!page) return res.sendStatus(404);
      
      // Trigger immediate run (will be handled by cron system)
      await context.triggerMonitorRun(page);
      res.json({message: 'Run triggered successfully'});
    })
  );

  return router;
}

module.exports = createRouter;
```

**Task 1.5: Integrate Routes vào Server (0.5 giờ)**

Update `packages/server/src/server.js`:

```javascript
const createMonitoredPagesRouter = require('./api/routes/monitored-pages.js');

// Add after existing routes
app.use('/v1/projects', createMonitoredPagesRouter(context));
```

**Task 1.6: Data Retention Logic (1.5 giờ)**

```javascript
// packages/server/src/cron/cleanup-old-data.js

const {CronJob} = require('cron');

/**
 * Delete builds and runs older than retention period
 * @param {LHCI.ServerCommand.StorageMethod} storageMethod
 * @param {number} retentionDays - Default 30 days
 */
async function cleanupOldData(storageMethod, retentionDays = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  
  const oldBuilds = await storageMethod.findBuildsBeforeTimestamp(cutoffDate);
  
  for (const build of oldBuilds) {
    await storageMethod.deleteBuild(build.projectId, build.id);
  }
  
  return oldBuilds.length;
}

/**
 * Start cron job to cleanup old data daily at 2 AM
 */
function startCleanupCron(storageMethod, options) {
  const retentionDays = options.dataRetentionDays || 30;
  
  const log = options.logLevel === 'silent'
    ? () => {}
    : msg => process.stdout.write(`${new Date().toISOString()} - ${msg}\n`);
  
  const cron = new CronJob('0 2 * * *', async () => {
    log('Starting data cleanup...');
    try {
      const deletedCount = await cleanupOldData(storageMethod, retentionDays);
      log(`Cleanup completed. Deleted ${deletedCount} old builds.`);
    } catch (err) {
      log(`Cleanup failed: ${err.message}`);
    }
  });
  
  cron.start();
  log(`Scheduled daily cleanup with ${retentionDays} days retention`);
}

module.exports = {startCleanupCron, cleanupOldData};
```

**✅ Deliverables Ngày 1:**
- Database schema với monitored_pages table
- CRUD API endpoints working
- Data retention cron job
- Unit tests cho storage methods

---

### NGÀY 2: CRON SYSTEM & LIGHTHOUSE INTEGRATION (8 giờ)

#### 🌅 Sáng (4 giờ): Dynamic Cron System

**Task 2.1: Refactor Lighthouse Runner (2 giờ)**

```javascript
// packages/server/src/cron/lighthouse-monitor.js

const {CronJob} = require('cron');
const Bluebird = require('bluebird');
const {getGravatarUrlFromEmail} = require('@lhci/utils/src/build-context');
const LighthouseRunner = require('@lhci/cli/src/collect/lighthouse-runner.js');

/**
 * Run Lighthouse for a monitored page
 */
async function runLighthouseForPage(storageMethod, page, project) {
  const numberOfRuns = 3; // Run 3 times and take median
  
  // Create build
  const build = await storageMethod.createBuild({
    projectId: project.id,
    lifecycle: 'unsealed',
    branch: project.baseBranch,
    externalBuildUrl: page.url,
    commitMessage: `Auto-monitor: ${page.label} at ${new Date().toLocaleString()}`,
    author: 'Lighthouse Monitor <monitor@example.com>',
    avatarUrl: getGravatarUrlFromEmail('monitor@example.com'),
    hash: Date.now().toString(16),
    runAt: new Date().toISOString(),
    committedAt: new Date().toISOString(),
  });
  
  // Run Lighthouse multiple times
  const lighthouseConfig = page.lighthouseConfig || {};
  
  for (let i = 0; i < numberOfRuns; i++) {
    try {
      const lhr = await runLighthouse(page.url, lighthouseConfig);
      
      await storageMethod.createRun({
        projectId: project.id,
        buildId: build.id,
        representative: false,
        url: page.url,
        lhr: JSON.stringify(lhr),
      });
    } catch (err) {
      console.error(`Lighthouse run failed for ${page.url}:`, err);
    }
  }
  
  // Seal build
  await storageMethod.sealBuild(build.projectId, build.id);
  
  // Update last run time
  await storageMethod.updateMonitoredPage(page.id, {
    lastRunAt: new Date(),
    nextRunAt: calculateNextRun(page.schedule),
  });
}

/**
 * Calculate next run time based on cron schedule
 */
function calculateNextRun(cronSchedule) {
  const cron = new CronJob(cronSchedule, () => {});
  return cron.nextDate().toDate();
}

/**
 * Run Lighthouse using CLI package
 */
async function runLighthouse(url, config = {}) {
  // Use existing Lighthouse CLI logic
  const {startLighthouse} = require('@lhci/cli/src/collect/lighthouse-runner.js');
  
  const result = await startLighthouse(url, {
    ...config,
    output: 'json',
  });
  
  return result.lhr;
}

module.exports = {
  runLighthouseForPage,
  calculateNextRun,
};
```

**Task 2.2: Dynamic Cron Manager (2 giờ)**

```javascript
// packages/server/src/cron/monitor-scheduler.js

const {CronJob} = require('cron');
const {runLighthouseForPage, calculateNextRun} = require('./lighthouse-monitor.js');

class MonitorScheduler {
  constructor(storageMethod, options) {
    this.storageMethod = storageMethod;
    this.options = options;
    this.jobs = new Map(); // pageId -> CronJob
    this.runningJobs = new Set(); // Track running jobs
  }

  /**
   * Initialize scheduler with all enabled pages
   */
  async initialize() {
    const pages = await this.storageMethod.getEnabledMonitoredPages();
    
    for (const page of pages) {
      this.schedulePageMonitoring(page);
    }
    
    this.log(`Initialized ${pages.length} monitoring schedules`);
  }

  /**
   * Schedule monitoring for a page
   */
  schedulePageMonitoring(page) {
    // Remove existing job if any
    this.unschedulePageMonitoring(page.id);
    
    if (!page.enabled) return;
    
    const job = new CronJob(page.schedule, async () => {
      await this.executeMonitoring(page);
    });
    
    this.jobs.set(page.id, job);
    job.start();
    
    this.log(`Scheduled monitoring for "${page.label}" with schedule: ${page.schedule}`);
  }

  /**
   * Execute monitoring for a page
   */
  async executeMonitoring(page) {
    const jobKey = `${page.id}-${Date.now()}`;
    
    if (this.runningJobs.has(page.id)) {
      this.log(`Monitoring for "${page.label}" already running, skipping...`);
      return;
    }
    
    this.runningJobs.add(page.id);
    this.log(`Starting monitoring for "${page.label}" (${page.url})`);
    
    try {
      const project = await this.storageMethod.findProjectById(page.projectId);
      if (!project) {
        this.log(`Project not found for page "${page.label}"`);
        return;
      }
      
      await runLighthouseForPage(this.storageMethod, page, project);
      this.log(`Completed monitoring for "${page.label}"`);
    } catch (err) {
      this.log(`Monitoring failed for "${page.label}": ${err.message}`);
    } finally {
      this.runningJobs.delete(page.id);
    }
  }

  /**
   * Unschedule monitoring for a page
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
   * Reload all schedules from database
   */
  async reloadSchedules() {
    // Stop all existing jobs
    for (const [pageId, job] of this.jobs.entries()) {
      job.stop();
    }
    this.jobs.clear();
    
    // Reinitialize
    await this.initialize();
  }

  /**
   * Trigger immediate run for a page
   */
  async triggerImmediateRun(pageId) {
    const page = await this.storageMethod.getMonitoredPage(pageId);
    if (!page) throw new Error('Page not found');
    
    await this.executeMonitoring(page);
  }

  log(message) {
    if (this.options.logLevel !== 'silent') {
      process.stdout.write(`${new Date().toISOString()} - [Monitor] ${message}\n`);
    }
  }
}

module.exports = {MonitorScheduler};
```

#### 🌆 Chiều (4 giờ): Integration & Testing

**Task 2.3: Integrate Scheduler vào Server (1 giờ)**

Update `packages/server/src/server.js`:

```javascript
const {MonitorScheduler} = require('./cron/monitor-scheduler.js');
const {startCleanupCron} = require('./cron/cleanup-old-data.js');

async function createApp(options) {
  // ... existing code ...
  
  log('[createApp] launching cron jobs');
  
  // Initialize monitor scheduler
  const monitorScheduler = new MonitorScheduler(storageMethod, options);
  await monitorScheduler.initialize();
  
  // Add scheduler to context for API access
  context.monitorScheduler = monitorScheduler;
  context.triggerMonitorRun = async (page) => {
    await monitorScheduler.triggerImmediateRun(page.id);
  };
  
  // Start cleanup cron
  startCleanupCron(storageMethod, options);
  
  // Existing cron jobs (optional, can be removed if not needed)
  // startPsiCollectCron(storageMethod, options);
  // startDeleteOldBuildsCron(storageMethod, options);
  
  return {app, storageMethod, monitorScheduler};
}
```

**Task 2.4: API Endpoint để Reload Schedules (0.5 giờ)**

Add to `monitored-pages.js`:

```javascript
// POST /v1/projects/:projectId/monitored-pages/reload-schedules
router.post(
  '/:projectId/monitored-pages/reload-schedules',
  validateAdminTokenMiddleware(context),
  handleAsyncError(async (req, res) => {
    await context.monitorScheduler.reloadSchedules();
    res.json({message: 'Schedules reloaded successfully'});
  })
);
```

**Task 2.5: Testing Backend (2.5 giờ)**

```javascript
// packages/server/test/monitored-pages.test.js

describe('Monitored Pages API', () => {
  it('should create a monitored page', async () => {
    const page = await storageMethod.createMonitoredPage({
      projectId: project.id,
      url: 'https://example.com',
      label: 'Example Homepage',
      schedule: '0 */6 * * *',
      enabled: true,
    });
    
    expect(page.id).toBeDefined();
    expect(page.url).toBe('https://example.com');
  });
  
  it('should schedule monitoring', async () => {
    // Test cron scheduling logic
  });
  
  it('should cleanup old data', async () => {
    // Test retention policy
  });
});
```

**✅ Deliverables Ngày 2:**
- Dynamic cron scheduler working
- Lighthouse integration functional
- Data cleanup cron running
- Backend fully tested

---

### NGÀY 3: PREACT UI COMPONENTS (8 giờ)

#### 🌅 Sáng (4 giờ): Page Management UI

**Task 3.1: API Hook cho Monitored Pages (1 giờ)**

```javascript
// packages/server/src/ui/hooks/use-monitored-pages.js

import {useState, useEffect} from 'preact/hooks';

export function useMonitoredPages(projectId) {
  const [loadingState, setLoadingState] = useState('loading');
  const [pages, setPages] = useState([]);
  
  useEffect(() => {
    if (!projectId) return;
    
    fetch(`/v1/projects/${projectId}/monitored-pages`)
      .then(res => res.json())
      .then(data => {
        setPages(data);
        setLoadingState('loaded');
      })
      .catch(err => {
        console.error(err);
        setLoadingState('error');
      });
  }, [projectId]);
  
  return [loadingState, pages, setPages];
}

export async function createMonitoredPage(projectId, pageData, adminToken) {
  const res = await fetch(`/v1/projects/${projectId}/monitored-pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LHCI-Admin-Token': adminToken,
    },
    body: JSON.stringify(pageData),
  });
  
  if (!res.ok) throw new Error('Failed to create page');
  return res.json();
}

export async function updateMonitoredPage(projectId, pageId, updates, adminToken) {
  const res = await fetch(`/v1/projects/${projectId}/monitored-pages/${pageId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-LHCI-Admin-Token': adminToken,
    },
    body: JSON.stringify(updates),
  });
  
  if (!res.ok) throw new Error('Failed to update page');
}

export async function deleteMonitoredPage(projectId, pageId, adminToken) {
  const res = await fetch(`/v1/projects/${projectId}/monitored-pages/${pageId}`, {
    method: 'DELETE',
    headers: {
      'X-LHCI-Admin-Token': adminToken,
    },
  });
  
  if (!res.ok) throw new Error('Failed to delete page');
}

export async function triggerMonitorRun(projectId, pageId, adminToken) {
  const res = await fetch(`/v1/projects/${projectId}/monitored-pages/${pageId}/trigger`, {
    method: 'POST',
    headers: {
      'X-LHCI-Admin-Token': adminToken,
    },
  });
  
  if (!res.ok) throw new Error('Failed to trigger run');
  return res.json();
}
```

**Task 3.2: Page List Component (2 giờ)**

```jsx
// packages/server/src/ui/routes/monitored-pages/page-list.jsx

import {h} from 'preact';
import {useState} from 'preact/hooks';
import {useMonitoredPages, deleteMonitoredPage, triggerMonitorRun} from '../../hooks/use-monitored-pages';
import './page-list.css';

export const MonitoredPageList = ({project, adminToken}) => {
  const [loadingState, pages, setPages] = useMonitoredPages(project.id);
  const [selectedPage, setSelectedPage] = useState(null);
  
  const handleDelete = async (pageId) => {
    if (!confirm('Are you sure you want to delete this page?')) return;
    
    try {
      await deleteMonitoredPage(project.id, pageId, adminToken);
      setPages(pages.filter(p => p.id !== pageId));
    } catch (err) {
      alert('Failed to delete page: ' + err.message);
    }
  };
  
  const handleTrigger = async (pageId) => {
    try {
      await triggerMonitorRun(project.id, pageId, adminToken);
      alert('Monitoring run triggered successfully!');
    } catch (err) {
      alert('Failed to trigger run: ' + err.message);
    }
  };
  
  if (loadingState === 'loading') return <div>Loading...</div>;
  if (loadingState === 'error') return <div>Error loading pages</div>;
  
  return (
    <div className="monitored-pages">
      <div className="monitored-pages__header">
        <h2>Monitored Pages</h2>
        <button 
          className="button button--primary"
          onClick={() => setSelectedPage({})}
        >
          + Add Page
        </button>
      </div>
      
      <table className="monitored-pages__table">
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
              <td>{page.label}</td>
              <td className="url-cell">{page.url}</td>
              <td>{page.schedule}</td>
              <td>{page.lastRunAt ? new Date(page.lastRunAt).toLocaleString() : 'Never'}</td>
              <td>{page.nextRunAt ? new Date(page.nextRunAt).toLocaleString() : '-'}</td>
              <td>
                <span className={`status status--${page.enabled ? 'enabled' : 'disabled'}`}>
                  {page.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </td>
              <td className="actions-cell">
                <button onClick={() => setSelectedPage(page)}>Edit</button>
                <button onClick={() => handleTrigger(page.id)}>Run Now</button>
                <button onClick={() => handleDelete(page.id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {selectedPage && (
        <PageFormModal
          project={project}
          page={selectedPage}
          adminToken={adminToken}
          onClose={() => setSelectedPage(null)}
          onSave={(newPage) => {
            if (selectedPage.id) {
              setPages(pages.map(p => p.id === newPage.id ? newPage : p));
            } else {
              setPages([...pages, newPage]);
            }
            setSelectedPage(null);
          }}
        />
      )}
    </div>
  );
};
```

**Task 3.3: Page Form Modal (1 giờ)**

```jsx
// packages/server/src/ui/routes/monitored-pages/page-form-modal.jsx

import {h} from 'preact';
import {useState} from 'preact/hooks';
import {createMonitoredPage, updateMonitoredPage} from '../../hooks/use-monitored-pages';

const SCHEDULE_PRESETS = [
  {label: 'Every Hour', value: '0 * * * *'},
  {label: 'Every 6 Hours', value: '0 */6 * * *'},
  {label: 'Daily at 2 AM', value: '0 2 * * *'},
  {label: 'Weekly (Monday 2 AM)', value: '0 2 * * 1'},
  {label: 'Custom', value: 'custom'},
];

export const PageFormModal = ({project, page, adminToken, onClose, onSave}) => {
  const isEdit = !!page.id;
  const [formData, setFormData] = useState({
    url: page.url || '',
    label: page.label || '',
    description: page.description || '',
    schedule: page.schedule || '0 */6 * * *',
    enabled: page.enabled !== undefined ? page.enabled : true,
  });
  
  const [schedulePreset, setSchedulePreset] = useState(
    SCHEDULE_PRESETS.find(p => p.value === formData.schedule)?.value || 'custom'
  );
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (isEdit) {
        await updateMonitoredPage(project.id, page.id, formData, adminToken);
        onSave({...page, ...formData});
      } else {
        const newPage = await createMonitoredPage(project.id, formData, adminToken);
        onSave(newPage);
      }
    } catch (err) {
      alert('Failed to save: ' + err.message);
    }
  };
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{isEdit ? 'Edit' : 'Add'} Monitored Page</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Label *</label>
            <input
              type="text"
              value={formData.label}
              onChange={e => setFormData({...formData, label: e.target.value})}
              required
            />
          </div>
          
          <div className="form-group">
            <label>URL *</label>
            <input
              type="url"
              value={formData.url}
              onChange={e => setFormData({...formData, url: e.target.value})}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          
          <div className="form-group">
            <label>Schedule Preset</label>
            <select
              value={schedulePreset}
              onChange={e => {
                const preset = e.target.value;
                setSchedulePreset(preset);
                if (preset !== 'custom') {
                  setFormData({...formData, schedule: preset});
                }
              }}
            >
              {SCHEDULE_PRESETS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          
          {schedulePreset === 'custom' && (
            <div className="form-group">
              <label>Cron Expression</label>
              <input
                type="text"
                value={formData.schedule}
                onChange={e => setFormData({...formData, schedule: e.target.value})}
                placeholder="0 */6 * * *"
              />
              <small>Format: minute hour day month weekday</small>
            </div>
          )}
          
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={e => setFormData({...formData, enabled: e.target.checked})}
              />
              Enabled
            </label>
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="button--primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

#### 🌆 Chiều (4 giờ): Dashboard Enhancement & Testing

**Task 3.4: Add Route cho Monitored Pages (0.5 giờ)**

Update `packages/server/src/ui/app.jsx`:

```jsx
<LazyRoute
  path="/app/projects/:projectSlug/monitored-pages"
  loading={() => (
    <Page>
      <LoadingSpinner />
    </Page>
  )}
  getComponent={() =>
    import('./routes/monitored-pages/monitored-pages.jsx').then(m => m.MonitoredPages)
  }
/>
```

**Task 3.5: Enhanced Dashboard với Page Filter (2 giờ)**

Update `project-dashboard.jsx` để thêm filter theo monitored page:

```jsx
// Add dropdown to filter by monitored page
<Dropdown
  label="Monitored Page"
  value={selectedPageId}
  setValue={setSelectedPageId}
  options={monitoredPages.map(p => ({value: p.id, label: p.label}))}
/>
```

**Task 3.6: Styling & Polish (1 giờ)**

```css
/* packages/server/src/ui/routes/monitored-pages/page-list.css */

.monitored-pages {
  padding: 20px;
}

.monitored-pages__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.monitored-pages__table {
  width: 100%;
  border-collapse: collapse;
}

.monitored-pages__table th,
.monitored-pages__table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.url-cell {
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status--enabled {
  background: #4caf50;
  color: white;
}

.status--disabled {
  background: #9e9e9e;
  color: white;
}

.actions-cell button {
  margin-right: 8px;
  padding: 4px 8px;
  font-size: 12px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  padding: 24px;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
}

.form-group input[type="text"],
.form-group input[type="url"],
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}
```

**Task 3.7: End-to-End Testing (0.5 giờ)**

Manual testing checklist:
- [ ] Create project
- [ ] Add monitored page
- [ ] Edit monitored page
- [ ] Trigger manual run
- [ ] View results in dashboard
- [ ] Check scheduled runs
- [ ] Delete monitored page
- [ ] Verify data retention (mock old data)

**✅ Deliverables Ngày 3:**
- Complete UI cho page management
- Schedule configuration working
- Dashboard showing results
- Full end-to-end flow functional

---

## 📊 TỔNG KẾT

### ✅ Scope Hoàn Thành Sau 3 Ngày

**Backend:**
- ✅ Database schema với monitored_pages
- ✅ CRUD API endpoints
- ✅ Dynamic cron scheduler
- ✅ Lighthouse integration
- ✅ Data retention (30 days)

**Frontend:**
- ✅ Page management UI (list, create, edit, delete)
- ✅ Schedule configuration với presets
- ✅ Manual trigger
- ✅ Dashboard với results
- ✅ Responsive design

**DevOps:**
- ✅ Migrations ready
- ✅ Cron jobs running
- ✅ Logging
- ✅ Error handling

### 🎯 Lợi Ích Của Việc Giữ Preact

1. **Tiết kiệm thời gian:** Không cần rebuild frontend (tiết kiệm ~1.5 ngày)
2. **Tái sử dụng components:** Dropdown, AsyncLoader, Charts, etc.
3. **Tái sử dụng hooks:** useProjectBySlug, useProjectBuilds, etc.
4. **Tái sử dụng styling:** Existing CSS framework
5. **Bundle size nhỏ:** Preact chỉ 3KB (vs React 40KB)

### 📈 Khả Năng Mở Rộng Sau 3 Ngày

**Phase 2 Features:**
- [ ] Multi-project support
- [ ] Email notifications
- [ ] Slack/Teams webhooks
- [ ] Custom alerts & thresholds
- [ ] Performance budgets
- [ ] Comparison với competitors
- [ ] Export reports (PDF)
- [ ] API for external integrations

**Infrastructure:**
- [ ] Redis caching
- [ ] Queue system (Bull)
- [ ] Docker compose
- [ ] Kubernetes deployment
- [ ] Monitoring (Prometheus)

---

## 🚀 NEXT STEPS

1. **Review & Approval** ✓
2. **Environment Setup:**
   - Node.js 16+
   - PostgreSQL/MySQL (hoặc SQLite cho dev)
   - Git clone repository
3. **Day 1 Kickoff:**
   - Create feature branch
   - Run migrations
   - Start backend development
4. **Daily Standup:**
   - Review progress
   - Adjust timeline if needed
5. **Day 3 Demo:**
   - Full walkthrough
   - Deploy to staging

---

**Confidence Level:** 95% ✅  
**Reason:** Giữ Preact giúp tái sử dụng 80% frontend code, chỉ cần thêm new components. Backend infrastructure đã sẵn sàng, chỉ cần extend.
