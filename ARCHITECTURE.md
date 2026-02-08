# Project: How I Met Your Tracker (GhostTraffic)

## Overview
A privacy-focused Chrome extension that makes invisible web tracking visible and controllable.

## Core Logic

### Manifest V3 Architecture
- Uses `declarativeNetRequest` for async domain blocking
- Background service worker handles request interception
- Content script renders UI overlay and processes tracker data

### Communication Flow
```
┌─────────────────────┐     GHOST_TRAFFIC      ┌─────────────────────┐
│  service_worker.js  │ ────────────────────▶  │  content_script.js  │
│  (Background)       │                        │  (UI + Logic)       │
└─────────────────────┘                        └─────────────────────┘
         ▲                                              │
         │              BLOCK_DOMAIN                    │
         └──────────────────────────────────────────────┘
```

### Storage
- In-memory: `domainCounts` Map, `blocked` Set
- Dynamic rules via `chrome.declarativeNetRequest`

## Critical Data Structures

```javascript
// Domain request counts
domainCounts: Map<string, number>  // { "google-analytics.com": 35 }

// Blocked domains set
blocked: Set<string>  // ["facebook.com", "hotjar.com"]

// Known high-risk trackers
HIGH_RISK_TRACKERS: string[]  // ["doubleclick.net", "hotjar.com", ...]

// Safe/allowed domains (CDNs, etc.)
SAFE_DOMAINS: string[]  // ["cloudflare.com", "gstatic.com", ...]
```

## UI Test IDs (data-testid)

| Element | Test ID | Purpose |
|---------|---------|---------|
| Main Panel | `panel-main` | Root container |
| Stats Counter | `stats-count` | Total request count |
| Background Toggle | `toggle-background` | Background mode switch |
| Block All Button | `btn-block-all` | Block all trackers |
| Export Button | `btn-export` | Export report |
| Domain Card | `card-{domain}` | Per-domain tracker card |
| Domain Toggle | `toggle-{domain}` | Per-domain block switch |
| Close Button | `btn-close` | Close panel |

## Agent Instructions for Testing

1. **Verify Panel Opens**: Click extension icon, check `data-testid="panel-main"` visible
2. **Verify Counter**: Load page with trackers, confirm `data-testid="stats-count"` increments
3. **Test Blocking**: Click `data-testid="toggle-{domain}"`, reload tab, verify blocked
4. **Test Export**: Click `data-testid="btn-export"`, verify HTML file downloads

## File Structure

```
DevSoc/
├── manifest.json          # Extension config
├── service_worker.js      # Background request listener
├── content_script.js      # UI overlay + tracking logic
├── rules.json             # Dynamic blocking rules
├── utils/
│   └── trackerLogic.js    # Pure utility functions
└── ARCHITECTURE.md        # This file
```
