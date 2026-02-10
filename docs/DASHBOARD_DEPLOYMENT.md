# Dashboard Deployment Guide

Complete guide to deploy the HIMT dashboard to AWS S3 + CloudFront.

---

## Prerequisites
- ✅ AWS CLI configured
- ✅ Node.js installed (v18+)
- ✅ Lambda functions deployed
- ✅ API Gateway working

---

## Step 1: Update API URL

Edit `dashboard/lib/api.ts` and update the `BASE_URL`:
```typescript
export const API_CONFIG = {
  BASE_URL: 'https://YOUR_ACTUAL_API_ID.execute-api.ap-south-1.amazonaws.com',
  // ...
};
```

---

## Step 2: Build the Dashboard

```powershell
cd "C:\Users\vaibh\Desktop\vaibhav\Vaibhav Projects\DevSoc\dashboard"
npm install
npm run build
```

This creates a static export in the `out/` folder.

---

## Step 3: Create S3 Bucket

```powershell
# Create bucket (bucket name must be globally unique)
aws s3 mb s3://himt-dashboard-YOUR_UNIQUE_ID --region ap-south-1

# Enable static website hosting
aws s3 website s3://himt-dashboard-YOUR_UNIQUE_ID --index-document index.html --error-document index.html
```

---

## Step 4: Configure Bucket Policy

Create a file `bucket-policy.json`:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::himt-dashboard-YOUR_UNIQUE_ID/*"
    }
  ]
}
```

Apply the policy:
```powershell
aws s3api put-bucket-policy --bucket himt-dashboard-YOUR_UNIQUE_ID --policy file://bucket-policy.json
```

---

## Step 5: Upload Dashboard Files

```powershell
aws s3 sync out/ s3://himt-dashboard-YOUR_UNIQUE_ID --delete
```

---

## Step 6: Create CloudFront Distribution (Optional but Recommended)

Using AWS Console:
1. Go to **CloudFront** → **Create Distribution**
2. Origin domain: `himt-dashboard-YOUR_UNIQUE_ID.s3.ap-south-1.amazonaws.com`
3. Origin access: **Legacy access identities** or **Origin access control (OAC)**
4. Default root object: `index.html`
5. Create distribution
6. Wait for deployment (5-10 mins)

Your dashboard will be available at: `https://d1234567890.cloudfront.net`

---

## Step 7: Update Extension with Dashboard URL

After deployment, you can add a button in the extension overlay to open the dashboard:

Edit `content_script.js` to add a dashboard link button.

---

## Quick Reference

| Resource | URL |
|----------|-----|
| S3 Bucket | `http://himt-dashboard-XXX.s3-website.ap-south-1.amazonaws.com` |
| CloudFront | `https://dXXXXXX.cloudfront.net` |
| API Gateway | `https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com` |

---

## Troubleshooting

### "Access Denied" on S3
- Check bucket policy allows public read
- Ensure block public access is disabled

### Dashboard shows no data
- Verify the API URL is correct in `lib/api.ts`
- Check browser console for CORS errors
- Ensure Lambda functions are deployed and API Gateway is configured

### CloudFront not updating
- Create an invalidation: `aws cloudfront create-invalidation --distribution-id XXXXX --paths "/*"`
