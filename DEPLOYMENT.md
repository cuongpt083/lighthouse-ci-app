# 🚀 Deployment Guide - Lighthouse CI Performance Monitor

**Version:** 1.0.0  
**Date:** 2026-01-14  
**Author:** Development Team

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Docker Deployment](#docker-deployment)
4. [Production Deployment](#production-deployment)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

### **System Requirements:**
- **Node.js:** v18.x or higher (v24.x recommended)
- **npm:** v9.x or higher
- **Database:** PostgreSQL 12+ / MySQL 8+ / SQLite 3+
- **Chrome/Chromium:** For Lighthouse (auto-installed)
- **Docker:** v20.x+ (for Docker deployment)
- **Docker Compose:** v2.x+ (for Docker deployment)

### **Minimum Hardware:**
- **CPU:** 2 cores
- **RAM:** 4GB (8GB recommended for production)
- **Disk:** 10GB free space
- **Network:** Stable internet connection

---

## 💻 Local Development Setup

### **Step 1: Clone Repository**

```bash
# Clone the repository
git clone https://github.com/your-org/lighthouse-ci-app.git
cd lighthouse-ci-app

# Checkout the feature branch
git checkout feature/web-performance-monitor
```

### **Step 2: Install Dependencies**

```bash
# Install root dependencies
npm install

# Bootstrap all packages (using Lerna)
npm run bootstrap

# Or manually install for each package
cd packages/server && npm install
cd ../cli && npm install
cd ../utils && npm install
```

### **Step 3: Database Setup**

#### **Option A: SQLite (Easiest for Development)**

```bash
# SQLite is default, no setup needed
# Database file will be created automatically at:
# .lighthouseci/lhci.db
```

#### **Option B: PostgreSQL**

```bash
# Install PostgreSQL
sudo apt-get install postgresql  # Ubuntu/Debian
brew install postgresql          # macOS

# Create database
createdb lighthouse_ci

# Create user (optional)
psql -c "CREATE USER lhci WITH PASSWORD 'your_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE lighthouse_ci TO lhci;"
```

#### **Option C: MySQL**

```bash
# Install MySQL
sudo apt-get install mysql-server  # Ubuntu/Debian
brew install mysql                 # macOS

# Create database
mysql -u root -p
CREATE DATABASE lighthouse_ci;
CREATE USER 'lhci'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON lighthouse_ci.* TO 'lhci'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### **Step 4: Configuration**

Create `.lighthouseci/lighthouserc.json`:

```json
{
  "ci": {
    "server": {
      "port": 9001,
      "storage": {
        "storageMethod": "sql",
        "sqlDialect": "sqlite",
        "sqlDatabasePath": "./.lighthouseci/lhci.db"
      }
    }
  }
}
```

**For PostgreSQL:**
```json
{
  "ci": {
    "server": {
      "port": 9001,
      "storage": {
        "storageMethod": "sql",
        "sqlDialect": "postgres",
        "sqlConnectionUrl": "postgresql://lhci:your_password@localhost:5432/lighthouse_ci"
      }
    }
  }
}
```

**For MySQL:**
```json
{
  "ci": {
    "server": {
      "port": 9001,
      "storage": {
        "storageMethod": "sql",
        "sqlDialect": "mysql",
        "sqlConnectionUrl": "mysql://lhci:your_password@localhost:3306/lighthouse_ci"
      }
    }
  }
}
```

### **Step 5: Run Migrations**

```bash
# Run database migrations
npm run migrate

# Or manually
cd packages/server
node src/cli.js migrate --config=../../.lighthouseci/lighthouserc.json
```

### **Step 6: Build Frontend**

```bash
# Build the UI
npm run build

# Or for development with watch mode
npm run build:watch
```

### **Step 7: Start Server**

```bash
# Start the server
npm start

# Or with custom config
npm start -- --config=.lighthouseci/lighthouserc.json

# Or in development mode with auto-reload
npm run dev
```

### **Step 8: Access Application**

Open browser and navigate to:
```
http://localhost:9001/app
```

### **Step 9: Create First Project**

```bash
# Using CLI
npx lhci wizard

# Or via API
curl -X POST http://localhost:9001/v1/projects \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Website",
    "externalUrl": "https://example.com",
    "baseBranch": "main"
  }'
```

---

## 🐳 Docker Deployment

### **Step 1: Create Dockerfile**

Create `Dockerfile` in project root:

```dockerfile
# Multi-stage build for optimized image
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY lerna.json ./
COPY packages/server/package*.json ./packages/server/
COPY packages/cli/package*.json ./packages/cli/
COPY packages/utils/package*.json ./packages/utils/

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build frontend
RUN npm run build

# Production stage
FROM node:18-alpine

# Install Chrome dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set Chrome path for Lighthouse
ENV CHROME_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy from builder
COPY --from=builder --chown=nodejs:nodejs /app ./

# Create data directory
RUN mkdir -p /data && chown nodejs:nodejs /data

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 9001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9001/healthz', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start server
CMD ["node", "packages/server/src/cli.js", "server", "--config=/app/.lighthouseci/lighthouserc.json"]
```

### **Step 2: Create Docker Compose**

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15-alpine
    container_name: lhci-postgres
    environment:
      POSTGRES_DB: lighthouse_ci
      POSTGRES_USER: lhci
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U lhci"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - lhci-network

  # Lighthouse CI Server
  lhci-server:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: lhci-server
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 9001
      # Database configuration
      LHCI_STORAGE_SQL_DIALECT: postgres
      LHCI_STORAGE_SQL_CONNECTION_URL: postgresql://lhci:${DB_PASSWORD:-changeme}@postgres:5432/lighthouse_ci
      # Data retention
      DATA_RETENTION_DAYS: 30
      CLEANUP_SCHEDULE: "0 2 * * *"
      # Logging
      LOG_LEVEL: verbose
    volumes:
      - ./data:/data
      - ./.lighthouseci:/app/.lighthouseci
    ports:
      - "9001:9001"
    restart: unless-stopped
    networks:
      - lhci-network
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:9001/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Nginx Reverse Proxy (Optional)
  nginx:
    image: nginx:alpine
    container_name: lhci-nginx
    depends_on:
      - lhci-server
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    ports:
      - "80:80"
      - "443:443"
    restart: unless-stopped
    networks:
      - lhci-network

volumes:
  postgres_data:
    driver: local

networks:
  lhci-network:
    driver: bridge
```

### **Step 3: Create Environment File**

Create `.env`:

```bash
# Database
DB_PASSWORD=your_secure_password_here

# Server
NODE_ENV=production
PORT=9001
LOG_LEVEL=verbose

# Data Retention
DATA_RETENTION_DAYS=30
CLEANUP_SCHEDULE=0 2 * * *

# Lighthouse
LIGHTHOUSE_RUNS=3
```

### **Step 4: Create Nginx Config (Optional)**

Create `nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream lhci {
        server lhci-server:9001;
    }

    server {
        listen 80;
        server_name your-domain.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        # Proxy settings
        location / {
            proxy_pass http://lhci;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Increase timeouts for Lighthouse runs
            proxy_connect_timeout 300s;
            proxy_send_timeout 300s;
            proxy_read_timeout 300s;
        }

        # Health check endpoint
        location /healthz {
            proxy_pass http://lhci;
            access_log off;
        }
    }
}
```

### **Step 5: Build and Run**

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f lhci-server

# Check status
docker-compose ps

# Run migrations
docker-compose exec lhci-server npm run migrate
```

### **Step 6: Access Application**

```
http://localhost:9001/app
# or
https://your-domain.com/app
```

---

## 🌐 Production Deployment

### **Recommended Setup:**

```
┌─────────────┐
│   Nginx     │ ← SSL Termination, Load Balancing
│  (Reverse   │
│   Proxy)    │
└──────┬──────┘
       │
┌──────▼──────────────────────────────┐
│   Lighthouse CI Server              │
│   - Node.js Application             │
│   - Cron Scheduler                  │
│   - Lighthouse Runner               │
└──────┬──────────────────────────────┘
       │
┌──────▼──────────────────────────────┐
│   PostgreSQL Database               │
│   - Monitored Pages Config          │
│   - Lighthouse Results              │
│   - Historical Data                 │
└─────────────────────────────────────┘
```

### **Production Checklist:**

#### **Security:**
- [ ] Use strong database passwords
- [ ] Enable SSL/TLS (HTTPS)
- [ ] Configure firewall rules
- [ ] Set up admin tokens
- [ ] Enable basic auth (optional)
- [ ] Regular security updates

#### **Performance:**
- [ ] Use PostgreSQL (not SQLite)
- [ ] Configure database connection pooling
- [ ] Set up database backups
- [ ] Monitor resource usage
- [ ] Configure log rotation

#### **Reliability:**
- [ ] Set up health checks
- [ ] Configure auto-restart
- [ ] Set up monitoring/alerting
- [ ] Configure data retention
- [ ] Regular backups

#### **Scalability:**
- [ ] Use external database
- [ ] Configure reverse proxy
- [ ] Set up load balancing (if needed)
- [ ] Monitor disk usage
- [ ] Plan for growth

---

## ⚙️ Configuration

### **Environment Variables:**

```bash
# Server
NODE_ENV=production
PORT=9001
HOST=0.0.0.0
LOG_LEVEL=verbose  # silent, verbose

# Database
LHCI_STORAGE_SQL_DIALECT=postgres  # sqlite, mysql, postgres
LHCI_STORAGE_SQL_CONNECTION_URL=postgresql://user:pass@host:5432/db
LHCI_STORAGE_SQL_DATABASE_PATH=./lhci.db  # For SQLite only

# Data Retention
DATA_RETENTION_DAYS=30
CLEANUP_SCHEDULE=0 2 * * *  # Daily at 2 AM

# Lighthouse
LIGHTHOUSE_RUNS=3
CHROME_PATH=/usr/bin/chromium-browser

# Authentication (Optional)
LHCI_BASIC_AUTH_USERNAME=admin
LHCI_BASIC_AUTH_PASSWORD=secure_password
```

### **lighthouserc.json:**

```json
{
  "ci": {
    "server": {
      "port": 9001,
      "host": "0.0.0.0",
      "logLevel": "verbose",
      "storage": {
        "storageMethod": "sql",
        "sqlDialect": "postgres",
        "sqlConnectionUrl": "postgresql://lhci:password@postgres:5432/lighthouse_ci",
        "sqlDangerouslyResetDatabase": false
      },
      "basicAuth": {
        "username": "admin",
        "password": "secure_password"
      }
    }
  }
}
```

---

## 🔍 Troubleshooting

### **Common Issues:**

#### **1. Port Already in Use**

```bash
# Find process using port 9001
lsof -i :9001
# or
netstat -tulpn | grep 9001

# Kill process
kill -9 <PID>

# Or use different port
PORT=9002 npm start
```

#### **2. Database Connection Failed**

```bash
# Check database is running
docker-compose ps postgres

# Check connection
psql -h localhost -U lhci -d lighthouse_ci

# Check connection URL
echo $LHCI_STORAGE_SQL_CONNECTION_URL

# View logs
docker-compose logs postgres
```

#### **3. Chrome/Chromium Not Found**

```bash
# Install Chrome
# Ubuntu/Debian
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb

# Alpine (Docker)
apk add chromium

# Set Chrome path
export CHROME_PATH=/usr/bin/google-chrome
# or
export CHROME_PATH=/usr/bin/chromium-browser
```

#### **4. Migration Errors**

```bash
# Reset database (CAUTION: Deletes all data)
rm .lighthouseci/lhci.db  # SQLite
# or
dropdb lighthouse_ci && createdb lighthouse_ci  # PostgreSQL

# Run migrations again
npm run migrate
```

#### **5. Build Errors**

```bash
# Clean and rebuild
npm run clean
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### **6. Docker Container Won't Start**

```bash
# Check logs
docker-compose logs lhci-server

# Check container status
docker-compose ps

# Restart services
docker-compose restart

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## 📊 Monitoring

### **Health Check:**

```bash
# Check server health
curl http://localhost:9001/healthz

# Expected response: "healthy"
```

### **Logs:**

```bash
# Local development
npm start  # Logs to console

# Docker
docker-compose logs -f lhci-server

# Production (systemd)
journalctl -u lighthouse-ci -f
```

### **Database:**

```bash
# Check database size
du -sh .lighthouseci/lhci.db  # SQLite

# PostgreSQL
psql -U lhci -d lighthouse_ci -c "SELECT pg_size_pretty(pg_database_size('lighthouse_ci'));"

# Check table sizes
psql -U lhci -d lighthouse_ci -c "SELECT schemaname,tablename,pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

---

## 🚀 Quick Start Commands

### **Local Development:**
```bash
git clone <repo>
cd lighthouse-ci-app
npm install
npm run build
npm start
# Open http://localhost:9001/app
```

### **Docker:**
```bash
git clone <repo>
cd lighthouse-ci-app
docker-compose up -d
docker-compose logs -f
# Open http://localhost:9001/app
```

### **Production:**
```bash
# See Production Deployment section above
```

---

## 📚 Additional Resources

- **Documentation:** `.analysis/` directory
- **Firewall Guide:** `.analysis/firewall-considerations.md`
- **Project Complete:** `.analysis/project-complete.md`
- **Lighthouse Docs:** https://github.com/GoogleChrome/lighthouse
- **LHCI Docs:** https://github.com/GoogleChrome/lighthouse-ci

---

## 🆘 Support

For issues or questions:
1. Check troubleshooting section above
2. Review documentation in `.analysis/`
3. Check GitHub issues
4. Contact development team

---

**Last Updated:** 2026-01-14  
**Version:** 1.0.0
