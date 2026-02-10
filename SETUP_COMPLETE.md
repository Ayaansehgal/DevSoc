# How I Met Your Tracker - Complete Setup Guide

## Quick Start Checklist

Follow these steps in order to set up the complete system.

---

## Phase 1: AWS Account Setup
📄 **Guide:** [docs/AWS_SETUP_GUIDE.md](./docs/AWS_SETUP_GUIDE.md)

- [ ] Create AWS Account
- [ ] Enable MFA on root account
- [ ] Create IAM user `himt-admin`
- [ ] Install AWS CLI
- [ ] Configure AWS CLI with access keys
- [ ] Create DynamoDB tables (TrackerEvents, DailyStats)
- [ ] Create Lambda execution role (HIMTLambdaRole)

**Estimated Time:** 30 minutes

---

## Phase 2: Deploy Lambda Functions
📄 **Guide:** [docs/LAMBDA_DEPLOYMENT.md](./docs/LAMBDA_DEPLOYMENT.md)

- [ ] Install npm dependencies in `backend/lambda/`
- [ ] Create deployment ZIP
- [ ] Deploy HIMTIngestEvents function
- [ ] Deploy HIMTGetAnalytics function
- [ ] Create API Gateway (HTTP API)
- [ ] Create routes (/events, /analytics)
- [ ] Test API endpoints

**Estimated Time:** 20 minutes

---

## Phase 3: Update Extension
📄 **Files:** [modules/cloud_sync.js](./modules/cloud_sync.js)

After getting your API URL from Phase 2:

- [ ] Edit `modules/cloud_sync.js`
- [ ] Replace `YOUR_API_ID` with your actual API Gateway ID
- [ ] Reload extension in Chrome (chrome://extensions)

**Your API URL format:** `https://abc123xyz.execute-api.ap-south-1.amazonaws.com`

---

## Phase 4: Deploy Dashboard
📄 **Guide:** [docs/DASHBOARD_DEPLOYMENT.md](./docs/DASHBOARD_DEPLOYMENT.md)

- [ ] Edit `dashboard/lib/api.ts` with your API URL
- [ ] Run `npm install` in dashboard folder
- [ ] Run `npm run build`
- [ ] Create S3 bucket
- [ ] Upload dashboard files
- [ ] (Optional) Set up CloudFront

**Estimated Time:** 15 minutes

---

## Testing the Complete Flow

1. **Load the Extension**
   - Go to `chrome://extensions`
   - Enable Developer Mode
   - Click "Load unpacked" and select the DevSoc folder

2. **Browse Some Websites**
   - Visit news sites, social media, shopping sites
   - The extension will detect and log trackers

3. **Check DynamoDB**
   ```powershell
   aws dynamodb scan --table-name TrackerEvents --limit 5 --region ap-south-1
   ```

4. **Open Dashboard**
   - Visit your S3/CloudFront URL
   - You should see your tracking data visualized

---

## File Structure Overview

```
DevSoc/
├── backend/
│   └── lambda/
│       ├── ingestEvents.js    # POST /events
│       ├── getAnalytics.js    # GET /analytics
│       └── package.json
├── dashboard/
│   ├── app/
│   │   ├── page.tsx           # Main dashboard
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Styling
│   ├── lib/
│   │   └── api.ts             # API client
│   └── package.json
├── docs/
│   ├── AWS_SETUP_GUIDE.md
│   ├── LAMBDA_DEPLOYMENT.md
│   └── DASHBOARD_DEPLOYMENT.md
├── modules/
│   └── cloud_sync.js          # Extension cloud sync
└── service_worker.js          # Updated with cloud sync
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CLI command fails | Ensure AWS CLI is configured: `aws sts get-caller-identity` |
| Lambda timeout | Increase timeout in Lambda config to 30s |
| CORS error | Check API Gateway CORS settings |
| No data in dashboard | Check browser console for errors |
| Extension not syncing | Check console in background page |

---

## Free Tier Monitoring

Set up billing alerts:
1. Go to AWS Billing → Budgets
2. Create a budget for $5/month
3. Get email alerts before charges occur

---

## Need Help?

Check the individual guide files in the `docs/` folder for detailed instructions.
