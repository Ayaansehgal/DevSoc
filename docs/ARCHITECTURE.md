# How I Met Your Tracker - System Architecture

## Overview

A privacy-focused browser extension with cloud-synced analytics dashboard. The extension detects and manages third-party trackers while syncing data to AWS for visualization.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER EXTENSION                               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐  │
│  │   Service   │  │   Content    │  │ Enforcement │  │   Cloud Sync     │  │
│  │   Worker    │◄─┤   Script     │  │   Engine    │  │   Module         │  │
│  └──────┬──────┘  └──────────────┘  └─────────────┘  └────────┬─────────┘  │
└─────────┼──────────────────────────────────────────────────────┼────────────┘
          │                                                       │
          │ deviceId sync                                         │ Events API
          ▼                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS CLOUD                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         API Gateway                                  │   │
│  │  /events  /analytics  /register  /login                             │   │
│  └──────┬────────┬───────────┬─────────┬───────────────────────────────┘   │
│         │        │           │         │                                    │
│         ▼        ▼           └────┬────┘                                    │
│  ┌────────────────────┐    ┌─────▼─────┐                                   │
│  │  Lambda Functions  │    │   Auth    │                                   │
│  │  - ingestEvents    │    │  Lambda   │                                   │
│  │  - getAnalytics    │    └─────┬─────┘                                   │
│  └─────────┬──────────┘          │                                         │
│            │                     │                                          │
│            ▼                     ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                         DynamoDB Tables                               │  │
│  │  TrackerEvents  │  DailyStats  │  Users                              │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
          ▲
          │ Fetch Analytics (deviceId)
          │
┌─────────┴───────────────────────────────────────────────────────────────────┐
│                         NEXT.JS DASHBOARD                                    │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌─────────────────────────┐  │
│  │  Login   │  │ Dashboard │  │  Charts    │  │ localStorage            │  │
│  │  Page    │  │   Page    │  │ (Recharts) │  │ - himt_device_id        │  │
│  └──────────┘  └───────────┘  └────────────┘  │ - himt_auth             │  │
│                                                └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Browser Extension

| File | Purpose |
|------|---------|
| `service_worker.js` | Background script - handles all tracker detection, enforcement, and messaging |
| `content_script.js` | Runs on every page - UI overlay, context detection, deviceId sync |
| `modules/cloud_sync.js` | Batches and syncs tracker events to AWS API |
| `modules/enforcement.js` | Manages Chrome declarativeNetRequest rules for blocking |
| `manifest.json` | Extension configuration |

**Key Flow:**
1. Service worker intercepts network requests
2. Matches against `tracker_kb.json` knowledge base
3. Applies enforcement (allow/restrict/sandbox/block)
4. Queues event in CloudSync module
5. CloudSync batches and sends to `/events` API every 30 seconds

### 2. AWS Backend

#### DynamoDB Tables

| Table | Partition Key | Sort Key | Purpose |
|-------|---------------|----------|---------|
| `TrackerEvents` | `deviceId` | `timestamp` | Raw tracker events |
| `DailyStats` | `deviceId` | `date` | Aggregated daily statistics |
| `Users` | `email` | - | User accounts and linked deviceIds |

#### Lambda Functions

| Function | Route | Purpose |
|----------|-------|---------|
| `HIMTIngestEvents` | `POST /events` | Receives tracker events, stores in DynamoDB |
| `HIMTGetAnalytics` | `GET /analytics` | Aggregates and returns analytics for deviceId |
| `HIMTAuth` | `POST /register, /login` | User registration and authentication |

### 3. Next.js Dashboard

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main dashboard with charts and stats |
| `app/login/page.tsx` | Login/Register page |
| `lib/api.ts` | API client, deviceId management |
| `lib/auth.ts` | Authentication logic, session management |
| `globals.css` | Glassmorphic theme styles |

---

## Authentication Flow

### Registration (New Account)
```
1. User enters email/password on /login
2. auth.ts generates NEW deviceId
3. Saves deviceId to localStorage
4. Calls POST /register with email, password, deviceId
5. Lambda creates user in DynamoDB with deviceId linked
6. Content script syncs new deviceId to extension (chrome.storage.local)
7. Extension starts sending data under new deviceId
8. Dashboard shows 0 data (fresh start)
```

### Login (Existing Account)
```
1. User enters email/password
2. Calls POST /login
3. Lambda returns user's linked deviceIds
4. Dashboard updates localStorage with account's deviceId
5. Content script syncs deviceId to extension
6. Dashboard fetches analytics for that deviceId
7. Shows that account's historical data
```

### DeviceId Sync (Bidirectional)
```
Content script runs on localhost:3000 and:
- If dashboard has NEW deviceId → updates extension
- If extension has deviceId but dashboard empty → copies to dashboard
- Checks every 2 seconds for changes
```

---

## Data Flow

### Tracker Detection → Cloud Storage
```
1. User visits website
2. Extension detects third-party requests
3. Matches against tracker_kb.json
4. Creates event: { domain, owner, category, riskScore, enforcementMode }
5. Queues in CloudSync (batches of 25)
6. Every 30s: POST /events → Lambda → DynamoDB
```

### Dashboard Analytics
```
1. Dashboard loads, reads deviceId from localStorage
2. GET /analytics?deviceId=xxx&range=7d
3. Lambda queries TrackerEvents + DailyStats
4. Returns: summary, topCompanies, topCategories, timeline, recentTrackers
5. Dashboard renders charts
```

---

## Security

| Component | Security Measure |
|-----------|------------------|
| Passwords | PBKDF2 with random salt (10,000 iterations) |
| Sessions | 7-day token stored in localStorage |
| API | CORS configured for extension and dashboard |
| IAM | Lambda execution role with DynamoDB access |

---

## Key Configuration

| Config | Location | Value |
|--------|----------|-------|
| API URL | `cloud_sync.js`, `api.ts` | `https://5xek4j5fma.execute-api.ap-south-1.amazonaws.com/prod` |
| DeviceId Key | localStorage/chrome.storage | `himt_device_id` |
| Auth Key | localStorage | `himt_auth` |
| Sync Interval | `cloud_sync.js` | 30 seconds |
| Batch Size | `cloud_sync.js` | 25 events |
