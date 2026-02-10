# How I Met Your Tracker - Getting Started Guide

Complete guide to run the extension, backend, and dashboard.

---

## Prerequisites

- **Node.js** 18+ 
- **AWS CLI** configured with credentials
- **Chrome** browser

---

## 1. Browser Extension

### Install Extension
```powershell
# Navigate to project
cd "C:\Users\vaibh\Desktop\vaibhav\Vaibhav Projects\DevSoc"

# No build needed - extension is vanilla JS
```

### Load in Chrome
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `DevSoc` folder
5. Extension icon appears in toolbar

### Reload Extension (after code changes)
1. Go to `chrome://extensions`
2. Click the ↻ refresh button on "How I Met Your Tracker"

---

## 2. AWS Backend

### First-Time Setup

#### Create DynamoDB Tables
```powershell
# TrackerEvents table
aws dynamodb create-table `
    --table-name TrackerEvents `
    --attribute-definitions AttributeName=deviceId,AttributeType=S AttributeName=timestamp,AttributeType=N `
    --key-schema AttributeName=deviceId,KeyType=HASH AttributeName=timestamp,KeyType=RANGE `
    --billing-mode PAY_PER_REQUEST `
    --region ap-south-1

# DailyStats table
aws dynamodb create-table `
    --table-name DailyStats `
    --attribute-definitions AttributeName=deviceId,AttributeType=S AttributeName=date,AttributeType=S `
    --key-schema AttributeName=deviceId,KeyType=HASH AttributeName=date,KeyType=RANGE `
    --billing-mode PAY_PER_REQUEST `
    --region ap-south-1

# Users table
aws dynamodb create-table `
    --table-name Users `
    --attribute-definitions AttributeName=email,AttributeType=S `
    --key-schema AttributeName=email,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region ap-south-1
```

#### Deploy Lambda Functions

See `docs/AUTH_DEPLOYMENT.md` for detailed Lambda deployment steps.

**Quick summary:**
```powershell
cd backend\lambda

# Package each function
# Create zip with node_modules
# Deploy using aws lambda create-function
```

### Update Lambda Code
```powershell
cd backend\lambda

# Repackage the function
Compress-Archive -Path * -DestinationPath function.zip -Force

# Update Lambda
aws lambda update-function-code `
    --function-name HIMTIngestEvents `
    --zip-file fileb://function.zip `
    --region ap-south-1
```

---

## 3. Dashboard (Next.js)

### Install Dependencies
```powershell
cd dashboard
npm install
```

### Run Development Server
```powershell
npm run dev
```
Dashboard available at: **http://localhost:3000**

### Build for Production
```powershell
npm run build
npm start
```

---

## 4. Complete Startup Sequence

### Daily Development Workflow
```powershell
# Terminal 1: Start dashboard
cd "C:\Users\vaibh\Desktop\vaibhav\Vaibhav Projects\DevSoc\dashboard"
npm run dev

# Browser: Load extension (if not already)
# 1. chrome://extensions
# 2. Load unpacked → select DevSoc folder

# Open dashboard
# http://localhost:3000
```

### After Code Changes

| Changed | Action |
|---------|--------|
| Extension files | Reload extension in chrome://extensions |
| Dashboard files | Auto-reloads (Next.js hot reload) |
| Lambda code | Redeploy using `aws lambda update-function-code` |

---

## 5. Testing the System

### Test Extension
1. Visit any website (e.g., amazon.com)
2. Click extension icon → See tracker panel
3. Check counts: Allowed, Restricted, Sandboxed, Blocked

### Test Dashboard
1. Open http://localhost:3000
2. Create account or login
3. Click "Refresh" to see latest data
4. Check console (F12) for debug logs

### Test API Directly
```powershell
# Test events endpoint
Invoke-RestMethod `
    -Uri "https://5xek4j5fma.execute-api.ap-south-1.amazonaws.com/prod/events" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"deviceId":"test123","events":[{"domain":"test.com","owner":"Test","category":"Test","timestamp":1234567890}]}'

# Test analytics endpoint
Invoke-RestMethod `
    -Uri "https://5xek4j5fma.execute-api.ap-south-1.amazonaws.com/prod/analytics?deviceId=test123&range=7d"
```

---

## 6. Troubleshooting

### Dashboard shows 0 data
1. Check browser console for deviceId logs
2. Ensure extension is loaded and syncing
3. Clear localStorage and re-register: `localStorage.clear()`

### Extension not syncing
1. Check service worker console: `chrome://extensions` → Inspect service worker
2. Look for `[HIMT Cloud]` logs
3. Verify API URL in `modules/cloud_sync.js`

### API errors
1. Check Lambda logs in CloudWatch
2. Verify DynamoDB tables exist
3. Check API Gateway CORS settings

---

## 7. Key URLs

| Resource | URL |
|----------|-----|
| Dashboard (dev) | http://localhost:3000 |
| API Gateway | https://5xek4j5fma.execute-api.ap-south-1.amazonaws.com/prod |
| Extension Debug | chrome://extensions |
| AWS Console | https://ap-south-1.console.aws.amazon.com |

---

## 8. Project Structure

```
DevSoc/
├── manifest.json           # Extension manifest
├── service_worker.js       # Background script
├── content_script.js       # Content script (UI + sync)
├── tracker_kb.json         # Tracker knowledge base
├── policies.json           # Enforcement policies
├── modules/
│   ├── cloud_sync.js       # AWS sync module
│   └── enforcement.js      # Blocking engine
├── ui/
│   └── styles.css          # Extension UI styles
├── backend/
│   └── lambda/
│       ├── ingestEvents.js # Event ingestion Lambda
│       ├── getAnalytics.js # Analytics Lambda
│       └── auth.js         # Auth Lambda
├── dashboard/
│   ├── app/
│   │   ├── page.tsx        # Main dashboard
│   │   ├── login/page.tsx  # Login page
│   │   └── globals.css     # Dashboard styles
│   └── lib/
│       ├── api.ts          # API client
│       └── auth.ts         # Auth client
└── docs/
    ├── ARCHITECTURE.md     # This file
    ├── GETTING_STARTED.md  # This file
    └── AUTH_DEPLOYMENT.md  # Auth deployment guide
```
