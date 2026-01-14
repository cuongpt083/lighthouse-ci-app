# 🔒 Firewall & Bot Detection Considerations

**Date:** 2026-01-14  
**Topic:** Running Lighthouse against websites with firewall/WAF protection

---

## ⚠️ **POTENTIAL ISSUES**

### **1. Bot Detection & Blocking**

Lighthouse sử dụng Chrome headless, có thể bị phát hiện và chặn bởi:

#### **Common Detection Methods:**
- ✅ **User-Agent sniffing** - Headless Chrome có UA đặc trưng
- ✅ **WebDriver detection** - `navigator.webdriver === true`
- ✅ **Headless detection** - Missing plugins, fonts, WebGL
- ✅ **Behavioral analysis** - Bot-like patterns
- ✅ **IP reputation** - Repeated requests từ cùng IP
- ✅ **Rate limiting** - Quá nhiều requests trong thời gian ngắn

#### **Popular WAF/Security Tools:**
- Cloudflare Bot Management
- AWS WAF
- Akamai Bot Manager
- Imperva (Incapsula)
- reCAPTCHA
- DataDome
- PerimeterX

---

## 🚨 **SYMPTOMS OF BLOCKING**

### **Lighthouse Will Fail With:**
```
Error: Failed to run Lighthouse for https://example.com
- HTTP 403 Forbidden
- HTTP 429 Too Many Requests
- Timeout errors
- CAPTCHA challenges
- Connection refused
```

### **In Logs You'll See:**
```
[Monitor] ❌ Monitoring failed for "Homepage"
   Error: Navigation timeout of 30000 ms exceeded
   
[Monitor] ❌ Monitoring failed for "Product Page"
   Error: HTTP 403: Access Denied
```

---

## ✅ **SOLUTIONS & WORKAROUNDS**

### **Solution 1: IP Whitelisting** ⭐ **RECOMMENDED**

**Cách tốt nhất:** Whitelist IP của Lighthouse CI server trong firewall.

#### **Implementation:**
```bash
# 1. Lấy public IP của server
curl ifconfig.me

# 2. Thêm IP vào whitelist trong:
# - Cloudflare: Firewall Rules → IP Access Rules
# - AWS WAF: IP Sets → Allow list
# - Nginx: allow directive
# - Apache: .htaccess rules
```

#### **Example Cloudflare Rule:**
```
(ip.src eq 203.0.113.10) and (http.user_agent contains "Chrome-Lighthouse")
Action: Allow
```

#### **Example Nginx:**
```nginx
# Allow Lighthouse CI server
geo $lighthouse_allowed {
    default 0;
    203.0.113.10 1;  # Your Lighthouse server IP
}

# In server block
if ($lighthouse_allowed = 0) {
    # Apply rate limiting or other restrictions
}
```

---

### **Solution 2: Custom User-Agent Header**

Cấu hình Lighthouse sử dụng custom User-Agent để bypass detection.

#### **Update lighthouse-monitor.js:**
```javascript
async function runLighthouse(url, config = {}, options = {}) {
  const lighthouse = require('lighthouse');
  const chromeLauncher = require('chrome-launcher');

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      // Add custom user agent
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LighthouseCI/1.0',
    ],
  });

  const lighthouseOptions = {
    logLevel: 'error',
    output: 'json',
    port: chrome.port,
    // Additional headers
    extraHeaders: {
      'X-Lighthouse-CI': 'true',
      'X-Monitoring-Tool': 'LighthouseCI',
    },
    ...config,
  };

  const runnerResult = await lighthouse(url, lighthouseOptions);
  await chrome.kill();
  
  return runnerResult.lhr;
}
```

---

### **Solution 3: Authentication Headers**

Nếu site yêu cầu authentication, thêm headers hoặc cookies.

#### **Update monitored-page-model.js:**
```javascript
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
}
```

#### **Example Config in UI:**
```json
{
  "extraHeaders": {
    "Authorization": "Bearer your-api-token",
    "X-API-Key": "your-api-key"
  },
  "throttling": {
    "rttMs": 40,
    "throughputKbps": 10240,
    "cpuSlowdownMultiplier": 1
  }
}
```

---

### **Solution 4: Rate Limiting Configuration**

Tránh trigger rate limiting bằng cách giảm tần suất chạy.

#### **Recommended Schedules:**
```javascript
// Instead of hourly
"0 * * * *"  // ❌ Too frequent

// Use these
"0 */6 * * *"   // ✅ Every 6 hours
"0 */12 * * *"  // ✅ Every 12 hours
"0 2 * * *"     // ✅ Daily at 2 AM
"0 2 * * 1"     // ✅ Weekly (Monday 2 AM)
```

#### **Reduce Number of Runs:**
```javascript
// In monitored-pages API
const build = await runLighthouseForPage(
  storageMethod,
  freshPage,
  project,
  {
    numberOfRuns: 1,  // ✅ Reduce from 3 to 1
    log: (msg) => this.log(`  ${msg}`),
  }
);
```

---

### **Solution 5: Proxy/VPN Configuration**

Sử dụng proxy để rotate IPs hoặc bypass geo-restrictions.

#### **Update lighthouse-monitor.js:**
```javascript
const chrome = await chromeLauncher.launch({
  chromeFlags: [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    // Add proxy
    '--proxy-server=http://proxy.example.com:8080',
  ],
});
```

#### **With Authentication:**
```javascript
const chrome = await chromeLauncher.launch({
  chromeFlags: [
    '--headless',
    '--no-sandbox',
    '--disable-gpu',
    '--proxy-server=http://proxy.example.com:8080',
    '--proxy-auth=username:password',
  ],
});
```

---

### **Solution 6: Delay Between Runs**

Thêm delay giữa các lần chạy để tránh trigger rate limiting.

#### **Update lighthouse-monitor.js:**
```javascript
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
    
    // ✅ Increase delay from 2s to 10s
    if (i < numberOfRuns - 1) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    }
  } catch (err) {
    log(`Lighthouse run ${i + 1} failed: ${err.message}`);
  }
}
```

---

### **Solution 7: VPN/Dedicated IP**

Chạy Lighthouse CI server trên VPN hoặc dedicated IP được whitelist.

#### **Options:**
1. **AWS EC2 with Elastic IP** - Stable IP, easy to whitelist
2. **Google Cloud with Static IP** - Similar to AWS
3. **VPN Service** - NordVPN, ExpressVPN (business plans)
4. **Dedicated Server** - Hetzner, OVH, DigitalOcean

---

## 🛠️ **IMPLEMENTATION GUIDE**

### **Step 1: Identify Blocking**

Thêm better error logging:

```javascript
// In lighthouse-monitor.js
async function runLighthouse(url, config = {}, options = {}) {
  const log = options.log || (() => {});
  
  try {
    const lighthouse = require('lighthouse');
    const chromeLauncher = require('chrome-launcher');

    log(`Launching Chrome for ${url}`);
    
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
    
    const runnerResult = await lighthouse(url, lighthouseOptions);
    
    await chrome.kill();
    
    if (!runnerResult || !runnerResult.lhr) {
      throw new Error('Lighthouse did not return a valid report');
    }

    log(`Lighthouse audit completed successfully`);
    
    return runnerResult.lhr;
  } catch (err) {
    // ✅ Better error logging
    log(`❌ Lighthouse execution failed: ${err.message}`);
    
    if (err.message.includes('403')) {
      log(`⚠️  Possible firewall/WAF blocking. Check IP whitelist.`);
    } else if (err.message.includes('429')) {
      log(`⚠️  Rate limiting detected. Reduce frequency or add delays.`);
    } else if (err.message.includes('timeout')) {
      log(`⚠️  Timeout - possible CAPTCHA or slow response.`);
    }
    
    throw new Error(`Failed to run Lighthouse for ${url}: ${err.message}`);
  }
}
```

---

### **Step 2: Configure Per-Page Settings**

Cho phép mỗi page có config riêng:

```javascript
// In UI - monitored-pages.jsx
const PageFormModal = ({page, onClose, onSave}) => {
  const [formData, setFormData] = useState({
    url: page.url || '',
    label: page.label || '',
    description: page.description || '',
    schedule: page.schedule || '0 */6 * * *',
    enabled: page.enabled !== undefined ? page.enabled : true,
    // ✅ Add advanced config
    lighthouseConfig: page.lighthouseConfig || {
      extraHeaders: {},
      throttling: {
        rttMs: 40,
        throughputKbps: 10240,
        cpuSlowdownMultiplier: 1
      }
    },
  });

  return (
    <div className="modal">
      {/* ... existing form fields ... */}
      
      {/* ✅ Add advanced settings */}
      <details>
        <summary>Advanced Settings</summary>
        <div className="form-group">
          <label>
            Custom Headers (JSON)
            <textarea
              value={JSON.stringify(formData.lighthouseConfig.extraHeaders, null, 2)}
              onChange={e => {
                try {
                  const headers = JSON.parse(e.target.value);
                  setFormData({
                    ...formData,
                    lighthouseConfig: {
                      ...formData.lighthouseConfig,
                      extraHeaders: headers
                    }
                  });
                } catch (err) {
                  // Invalid JSON, ignore
                }
              }}
              rows="4"
              placeholder='{"Authorization": "Bearer token"}'
            />
          </label>
        </div>
      </details>
    </div>
  );
};
```

---

### **Step 3: Add Retry Logic**

Tự động retry khi gặp lỗi tạm thời:

```javascript
// In lighthouse-monitor.js
async function runLighthouseWithRetry(url, config, options, maxRetries = 3) {
  const log = options.log || (() => {});
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      log(`Attempt ${attempt}/${maxRetries} for ${url}`);
      return await runLighthouse(url, config, options);
    } catch (err) {
      log(`Attempt ${attempt} failed: ${err.message}`);
      
      if (attempt === maxRetries) {
        throw err;
      }
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Use in runLighthouseForPage
const lhr = await runLighthouseWithRetry(page.url, lighthouseConfig, options);
```

---

## 📋 **CHECKLIST FOR PRODUCTION**

### **Before Deploying:**
- [ ] Identify if target sites have WAF/firewall
- [ ] Get server's public IP address
- [ ] Request IP whitelist from site owners
- [ ] Test Lighthouse manually against target sites
- [ ] Configure custom User-Agent if needed
- [ ] Set appropriate schedule (not too frequent)
- [ ] Add authentication headers if required
- [ ] Implement retry logic
- [ ] Add comprehensive error logging
- [ ] Test with 1 page first before adding more

### **Monitoring:**
- [ ] Check logs for 403/429 errors
- [ ] Monitor success rate
- [ ] Track response times
- [ ] Set up alerts for failures
- [ ] Review firewall logs (if accessible)

---

## 🎯 **RECOMMENDED APPROACH**

### **For Internal/Controlled Sites:**
1. ✅ **IP Whitelist** - Best solution
2. ✅ **Custom headers** - For authentication
3. ✅ **Reasonable schedule** - Every 6-12 hours

### **For External/Third-party Sites:**
1. ⚠️ **Get permission first** - Legal/ethical
2. ✅ **Use public monitoring tools** - PageSpeed Insights API
3. ✅ **Respect rate limits** - Daily or weekly checks
4. ✅ **Use proxy** - If allowed

### **For High-security Sites:**
1. ✅ **Dedicated monitoring server** - Stable IP
2. ✅ **VPN with static IP** - Whitelistable
3. ✅ **API-based monitoring** - If available
4. ✅ **Coordinate with security team** - Get proper access

---

## ⚡ **QUICK FIXES**

### **If Getting Blocked Right Now:**

```bash
# 1. Check if it's really blocking
curl -I https://your-site.com
curl -A "Chrome-Lighthouse" -I https://your-site.com

# 2. Temporarily disable the page
# In database or UI, set enabled = false

# 3. Contact site admin for IP whitelist
# Provide your server IP

# 4. Reduce frequency
# Change schedule from hourly to daily

# 5. Add delay between runs
# Edit lighthouse-monitor.js, increase setTimeout to 30000 (30s)
```

---

## 📞 **SUPPORT RESOURCES**

### **Documentation:**
- Lighthouse: https://github.com/GoogleChrome/lighthouse
- Chrome Headless: https://developers.google.com/web/updates/2017/04/headless-chrome
- Puppeteer Stealth: https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth

### **Tools:**
- Check if site blocks headless: https://bot.sannysoft.com/
- Test User-Agent: https://www.whatismybrowser.com/
- IP Lookup: https://whatismyipaddress.com/

---

## 💡 **BEST PRACTICES**

1. ✅ **Always get permission** before monitoring external sites
2. ✅ **Start with low frequency** (daily/weekly)
3. ✅ **Monitor your own sites first** to test
4. ✅ **Use staging environment** for testing
5. ✅ **Implement proper error handling**
6. ✅ **Log everything** for debugging
7. ✅ **Have fallback plans** (manual checks)
8. ✅ **Communicate with site owners** about monitoring

---

**Summary:** Firewall blocking là vấn đề phổ biến. Giải pháp tốt nhất là **IP whitelisting** + **reasonable scheduling** + **proper error handling**.

**Prepared by:** AI Assistant  
**Date:** 2026-01-14 15:25
