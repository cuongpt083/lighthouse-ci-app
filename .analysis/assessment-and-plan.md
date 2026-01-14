# Đánh Giá Khả Năng Nâng Cấp Lighthouse CI App

**Ngày đánh giá:** 2026-01-14  
**Người đánh giá:** Senior Full-Stack Developer  
**Thời gian dự kiến:** 3 ngày làm việc

---

## 1. TỔNG QUAN MÃ NGUỒN HIỆN TẠI

### 1.1. Kiến Trúc Hệ Thống
Lighthouse CI App hiện tại được xây dựng theo kiến trúc **monorepo** với Lerna, bao gồm 4 packages chính:

```
lighthouse-ci-app/
├── packages/
│   ├── cli/          # CLI tool để chạy Lighthouse
│   ├── server/       # Backend server (Express.js)
│   ├── utils/        # Shared utilities
│   └── viewer/       # UI viewer (Preact)
```

### 1.2. Tech Stack Hiện Tại

**Backend:**
- Node.js + Express.js
- Sequelize ORM (hỗ trợ SQLite, PostgreSQL, MySQL)
- Cron jobs cho scheduled tasks
- RESTful API

**Frontend:**
- Preact (thay vì React để giảm bundle size)
- Preact Router
- D3.js & Plotly.js cho visualization
- esbuild cho bundling

**Database:**
- Sequelize với migrations
- Models: Project, Build, Run, Statistic
- Hỗ trợ đa database: SQLite, PostgreSQL, MySQL

**Tính năng nổi bật đã có:**
- ✅ Database schema với migrations
- ✅ Cron job infrastructure (psi-collect.js, delete-old-builds.js)
- ✅ API endpoints cho CRUD operations
- ✅ Storage layer abstraction
- ✅ Authentication (build token, admin token, basic auth)
- ✅ Dashboard UI với charts

---

## 2. ĐÁNH GIÁ KHẢ NĂNG NÂNG CẤP

### 2.1. Điểm Mạnh (Strengths) ⭐⭐⭐⭐⭐

#### A. Cơ Sở Hạ Tầng Sẵn Sàng
1. **Database Layer hoàn chỉnh:**
   - Sequelize ORM đã được cấu hình tốt
   - Migration system có sẵn
   - Models đã định nghĩa rõ ràng (Project, Build, Run, Statistic)
   - Hỗ trợ transactions

2. **Cron Job Infrastructure:**
   - File `packages/server/src/cron/psi-collect.js` đã implement scheduled collection
   - Sử dụng thư viện `cron` cho scheduling
   - Có logic để chạy Lighthouse cho multiple URLs
   - Có cơ chế prevent concurrent runs

3. **API Layer:**
   - RESTful API đã được thiết kế tốt
   - Routes cho projects, builds, runs, statistics
   - Error handling middleware
   - Authentication middleware

4. **Storage Abstraction:**
   - Storage Method pattern cho flexibility
   - Dễ dàng extend hoặc customize

#### B. Tính Năng Cốt Lõi
1. **Lighthouse Integration:**
   - CLI package đã tích hợp Lighthouse
   - PSI (PageSpeed Insights) runner có sẵn
   - Logic để run multiple times và lấy median

2. **Data Persistence:**
   - Lưu trữ LHR (Lighthouse Report) dạng JSON
   - Statistics calculation và storage
   - Historical data tracking

3. **Visualization:**
   - Dashboard UI với charts (D3.js, Plotly.js)
   - Trend analysis over time
   - Build comparison

### 2.2. Điểm Cần Cải Thiện (Gaps) 🔧

#### A. Frontend Framework
- **Hiện tại:** Preact (lightweight React alternative)
- **Yêu cầu:** Angular
- **Đánh giá:** Cần rebuild toàn bộ frontend

#### B. Scheduled Collection
- **Hiện tại:** PSI collect cron (chạy qua PageSpeed Insights API)
- **Yêu cầu:** Tự chạy Lighthouse locally/scheduled
- **Đánh giá:** Cần adapt logic từ CLI sang scheduled jobs

#### C. Configuration Management
- **Hiện tại:** Config qua CLI arguments hoặc lighthouserc.js
- **Yêu cầu:** UI để manage danh sách web pages
- **Đánh giá:** Cần thêm CRUD UI cho page configuration

---

## 3. KẾ HOẠCH THỰC HIỆN (3 NGÀY)

### 📅 NGÀY 1: BACKEND ENHANCEMENT & DATABASE SETUP

#### Morning (4 giờ)
**Task 1.1: Database Schema Extension**
- [ ] Tạo migration mới cho bảng `page_configurations`
  ```sql
  - id (UUID)
  - projectId (FK)
  - url (VARCHAR)
  - label (VARCHAR)
  - schedule (VARCHAR) -- cron expression
  - enabled (BOOLEAN)
  - lighthouse_config (JSON) -- custom Lighthouse config
  - created_at, updated_at
  ```
- [ ] Tạo Sequelize model cho PageConfiguration
- [ ] Thêm relationships: Project hasMany PageConfigurations

**Task 1.2: API Endpoints cho Page Management**
- [ ] `GET /v1/projects/:projectId/pages` - List pages
- [ ] `POST /v1/projects/:projectId/pages` - Create page
- [ ] `PUT /v1/projects/:projectId/pages/:pageId` - Update page
- [ ] `DELETE /v1/projects/:projectId/pages/:pageId` - Delete page
- [ ] `POST /v1/projects/:projectId/pages/:pageId/test` - Manual trigger

#### Afternoon (4 giờ)
**Task 1.3: Enhanced Cron Job System**
- [ ] Refactor `psi-collect.js` thành `lighthouse-collect.js`
- [ ] Thay PSI runner bằng local Lighthouse runner
- [ ] Dynamic cron registration từ database
- [ ] Implement cron reload khi có config changes
- [ ] Add logging và error tracking

**Task 1.4: Testing Backend**
- [ ] Unit tests cho new models
- [ ] Integration tests cho API endpoints
- [ ] Test cron job logic

**Deliverables Ngày 1:**
- ✅ Database schema updated
- ✅ API endpoints working
- ✅ Cron system functional
- ✅ Backend tests passing

---

### 📅 NGÀY 2: ANGULAR FRONTEND FOUNDATION

#### Morning (4 giờ)
**Task 2.1: Angular Project Setup**
- [ ] Tạo Angular workspace mới (Angular 17+)
  ```bash
  ng new lighthouse-ci-angular --routing --style=scss
  ```
- [ ] Cấu hình Angular Material hoặc PrimeNG
- [ ] Setup environment configuration
- [ ] Configure proxy cho API calls

**Task 2.2: Core Angular Structure**
- [ ] Tạo module structure:
  ```
  src/app/
  ├── core/           # Singleton services
  ├── shared/         # Shared components
  ├── features/
  │   ├── projects/   # Project management
  │   ├── pages/      # Page configuration
  │   ├── dashboard/  # Dashboard & charts
  │   └── reports/    # Report viewing
  ```
- [ ] Setup routing
- [ ] Create layout components (header, sidebar, footer)

#### Afternoon (4 giờ)
**Task 2.3: Services Layer**
- [ ] `ProjectService` - CRUD cho projects
- [ ] `PageConfigService` - CRUD cho page configurations
- [ ] `BuildService` - Fetch builds & runs
- [ ] `StatisticService` - Fetch statistics
- [ ] HTTP interceptor cho authentication
- [ ] Error handling service

**Task 2.4: Authentication Integration**
- [ ] Login component
- [ ] Auth guard
- [ ] Token management
- [ ] Basic auth integration

**Deliverables Ngày 2:**
- ✅ Angular app structure ready
- ✅ Services communicating with backend
- ✅ Authentication working
- ✅ Basic navigation functional

---

### 📅 NGÀY 3: CORE FEATURES & INTEGRATION

#### Morning (4 giờ)
**Task 3.1: Page Configuration UI**
- [ ] Page list component với table
  - Columns: URL, Label, Schedule, Status, Actions
  - Actions: Edit, Delete, Run Now
- [ ] Page form component (Create/Edit)
  - URL input với validation
  - Label input
  - Cron schedule picker (hoặc preset options)
  - Lighthouse config (optional JSON editor)
  - Enable/Disable toggle
- [ ] Confirmation dialogs
- [ ] Toast notifications

**Task 3.2: Dashboard Enhancement**
- [ ] Project selector dropdown
- [ ] Page filter/selector
- [ ] Time range selector
- [ ] Performance metrics cards
  - Performance Score
  - Accessibility Score
  - Best Practices Score
  - SEO Score
- [ ] Trend charts (reuse existing chart logic hoặc dùng ng2-charts)

#### Afternoon (4 giờ)
**Task 3.3: Reports & History**
- [ ] Build history table
  - Columns: Date, Branch, Status, Scores
  - Click to view details
- [ ] Run details view
  - Display full Lighthouse report
  - Comparison với previous run
- [ ] Export functionality (CSV/PDF)

**Task 3.4: Integration & Testing**
- [ ] End-to-end testing với Protractor/Cypress
- [ ] Manual testing toàn bộ flow:
  1. Create project
  2. Add page configurations
  3. Trigger manual run
  4. View results in dashboard
  5. Check scheduled runs
- [ ] Bug fixes
- [ ] Performance optimization

**Task 3.5: Documentation**
- [ ] README.md update
- [ ] API documentation
- [ ] User guide
- [ ] Deployment guide

**Deliverables Ngày 3:**
- ✅ Full CRUD cho page configurations
- ✅ Dashboard với charts
- ✅ Report viewing
- ✅ End-to-end flow working
- ✅ Documentation complete

---

## 4. KIẾN TRÚC MỚI ĐỀ XUẤT

### 4.1. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Angular Frontend                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Projects │  │  Pages   │  │Dashboard │             │
│  │  Module  │  │  Module  │  │  Module  │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                       │                                  │
│                       ▼                                  │
│              ┌─────────────────┐                        │
│              │  HTTP Services  │                        │
│              └─────────────────┘                        │
└───────────────────────┬─────────────────────────────────┘
                        │ REST API
                        ▼
┌─────────────────────────────────────────────────────────┐
│                  Express.js Backend                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │   API    │  │   Cron   │  │ Storage  │             │
│  │  Routes  │  │  Jobs    │  │  Layer   │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                       │                                  │
│                       ▼                                  │
│              ┌─────────────────┐                        │
│              │ Lighthouse Core │                        │
│              └─────────────────┘                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Database (PostgreSQL/MySQL)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Projects │  │  Pages   │  │  Builds  │             │
│  ├──────────┤  ├──────────┤  ├──────────┤             │
│  │   Runs   │  │Statistics│  │  Users   │             │
│  └──────────┘  └──────────┘  └──────────┘             │
└─────────────────────────────────────────────────────────┘
```

### 4.2. Data Flow

```
1. User configures pages via Angular UI
   ↓
2. API saves to database
   ↓
3. Cron job reads configurations
   ↓
4. Lighthouse runs on schedule
   ↓
5. Results saved to database
   ↓
6. Angular dashboard displays trends
```

---

## 5. RỦI RO & GIẢI PHÁP

### 5.1. Rủi Ro Kỹ Thuật

| Rủi Ro | Mức Độ | Giải Pháp |
|---------|---------|-----------|
| Lighthouse chạy chậm với nhiều URLs | Cao | Implement queue system, parallel execution với limit |
| Database performance với large dataset | Trung Bình | Indexing, pagination, data retention policy |
| Frontend bundle size lớn | Thấp | Lazy loading modules, tree shaking |
| Cron jobs conflict | Trung Bình | Mutex locks, job queue |

### 5.2. Rủi Ro Thời Gian

| Rủi Ro | Mức Độ | Giải Pháp |
|---------|---------|-----------|
| Angular learning curve | Thấp | Sử dụng Angular CLI, Material components |
| Chart integration phức tạp | Trung Bình | Reuse existing D3/Plotly logic hoặc dùng ng2-charts |
| Testing mất nhiều thời gian | Cao | Focus vào critical path testing |

---

## 6. PHẠM VI NGOÀI 3 NGÀY (FUTURE ENHANCEMENTS)

Những tính năng sau có thể implement sau 3 ngày:

1. **Advanced Features:**
   - [ ] Multi-user support với roles
   - [ ] Email notifications khi có regression
   - [ ] Slack/Teams integration
   - [ ] Custom alerts & thresholds
   - [ ] A/B testing support

2. **Performance:**
   - [ ] Redis caching
   - [ ] WebSocket cho real-time updates
   - [ ] Background job queue (Bull/Bee-Queue)

3. **DevOps:**
   - [ ] Docker compose setup
   - [ ] Kubernetes deployment
   - [ ] CI/CD pipeline
   - [ ] Monitoring & logging (Prometheus, Grafana)

---

## 7. KẾT LUẬN

### 7.1. Đánh Giá Tổng Thể: ⭐⭐⭐⭐⭐ (5/5)

**Mã nguồn lighthouse-ci-app RẤT PHÙ HỢP để nâng cấp theo yêu cầu vì:**

✅ **Backend infrastructure gần như hoàn chỉnh:**
- Database schema tốt, chỉ cần extend
- API pattern rõ ràng, dễ thêm endpoints
- Cron job system đã có, chỉ cần customize

✅ **Lighthouse integration sẵn sàng:**
- CLI package đã tích hợp Lighthouse
- PSI runner có thể adapt thành local runner
- Logic chạy multiple runs đã có

✅ **Có thể tái sử dụng 70-80% backend code:**
- Storage layer
- API routes (chỉ cần extend)
- Authentication
- Cron infrastructure

❌ **Chỉ cần rebuild frontend (20-30% effort):**
- Preact → Angular migration
- UI components mới
- State management

### 7.2. Khả Năng Hoàn Thành Trong 3 Ngày: ✅ KHẢ THI

**Với điều kiện:**
1. Focus vào core features (CRUD pages, scheduled runs, basic dashboard)
2. Reuse maximum backend code
3. Sử dụng UI component library (Angular Material/PrimeNG)
4. Postpone advanced features (notifications, alerts, etc.)

**Deliverables sau 3 ngày:**
- ✅ Working Angular app với page configuration UI
- ✅ Scheduled Lighthouse runs từ database config
- ✅ Dashboard hiển thị performance trends
- ✅ Basic authentication
- ✅ API documentation
- ✅ Deployment ready

### 7.3. Khuyến Nghị

**Nên làm:**
1. Giữ nguyên backend structure, chỉ extend
2. Sử dụng Angular CLI để tăng tốc độ development
3. Dùng UI component library có sẵn
4. Focus vào MVP features trước

**Không nên:**
1. Refactor toàn bộ backend (không cần thiết)
2. Build custom UI components từ đầu
3. Implement advanced features ngay từ đầu
4. Thay đổi database schema quá nhiều

---

## 8. NEXT STEPS

1. **Review & Approval:** Xem xét plan này và confirm scope
2. **Environment Setup:** Chuẩn bị dev environment (Node.js, Angular CLI, Database)
3. **Kickoff:** Bắt đầu implementation theo timeline
4. **Daily Sync:** Review progress cuối mỗi ngày
5. **Demo:** Present working prototype sau 3 ngày

---

**Prepared by:** Senior Full-Stack Developer  
**Date:** 2026-01-14  
**Estimated Effort:** 3 days (24 working hours)  
**Confidence Level:** High (85%)
