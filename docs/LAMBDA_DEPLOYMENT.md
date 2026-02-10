# Lambda Deployment Guide

Complete step-by-step guide to deploy Lambda functions and set up API Gateway.

---

## Prerequisites
- ✅ AWS CLI configured (run `aws sts get-caller-identity` to verify)
- ✅ DynamoDB tables created (TrackerEvents, DailyStats)
- ✅ Lambda role created (HIMTLambdaRole)
- ✅ Your Role ARN: `arn:aws:iam::639140328163:role/HIMTLambdaRole`

---

## Part 1: Install Dependencies (2 mins)

### Step 1.1: Open PowerShell and Navigate to Lambda Folder
```powershell
cd "C:\Users\vaibh\Desktop\vaibhav\Vaibhav Projects\DevSoc\backend\lambda"
```

### Step 1.2: Verify You're in the Right Folder
```powershell
dir
```

**Expected output:** You should see `ingestEvents.js`, `getAnalytics.js`, and `package.json`

### Step 1.3: Install Node.js Dependencies
```powershell
npm install
```

**Wait for installation to complete.** You'll see a `node_modules` folder created.

---

## Part 2: Create Deployment Package (2 mins)

### Step 2.1: Create ZIP File
Copy and paste this command:
```powershell
Compress-Archive -Path *.js,package.json,node_modules -DestinationPath ..\lambda-package.zip -Force
```

**No output = success**

### Step 2.2: Verify ZIP Was Created
```powershell
dir ..\lambda-package.zip
```

**Expected output:** Shows the zip file with its size

---

## Part 3: Deploy Lambda Functions (5 mins)

### Step 3.1: Create HIMTIngestEvents Function
Copy and paste this ENTIRE command (it's multiple lines with backticks):
```powershell
aws lambda create-function --function-name HIMTIngestEvents --runtime nodejs18.x --role "arn:aws:iam::639140328163:role/HIMTLambdaRole" --handler ingestEvents.handler --zip-file fileb://../lambda-package.zip --timeout 30 --memory-size 256 --region ap-south-1
```

**Expected output:** JSON with `"FunctionName": "HIMTIngestEvents"` and `"State": "Pending"` or `"Active"`

### Step 3.2: Create HIMTGetAnalytics Function
Copy and paste:
```powershell
aws lambda create-function --function-name HIMTGetAnalytics --runtime nodejs18.x --role "arn:aws:iam::639140328163:role/HIMTLambdaRole" --handler getAnalytics.handler --zip-file fileb://../lambda-package.zip --timeout 30 --memory-size 256 --region ap-south-1
```

**Expected output:** JSON with `"FunctionName": "HIMTGetAnalytics"`

### Step 3.3: Verify Both Functions Exist
```powershell
aws lambda list-functions --query "Functions[?contains(FunctionName, 'HIMT')].FunctionName" --output text --region ap-south-1
```

**Expected output:** 
```
HIMTGetAnalytics    HIMTIngestEvents
```

---

## Part 4: Create API Gateway (5 mins)

### Step 4.1: Create HTTP API
Copy and paste:
```powershell
aws apigatewayv2 create-api --name HIMT-API --protocol-type HTTP --cors-configuration AllowOrigins="*",AllowMethods="GET,POST,OPTIONS",AllowHeaders="Content-Type,X-Device-Id" --region ap-south-1
```

**Expected output:** JSON containing `"ApiId": "xxxxxxxxxx"` (something like `a1b2c3d4e5`)

**⚠️ WRITE DOWN YOUR API ID!** You'll need it for the next steps.

My API ID is: `_______________` (fill this in)

### Step 4.2: Get Lambda Function ARNs
Run these commands one by one:

**Get Ingest ARN:**
```powershell
aws lambda get-function --function-name HIMTIngestEvents --query "Configuration.FunctionArn" --output text --region ap-south-1
```

**Write down the output** (looks like `arn:aws:lambda:ap-south-1:639140328163:function:HIMTIngestEvents`)

**Get Analytics ARN:**
```powershell
aws lambda get-function --function-name HIMTGetAnalytics --query "Configuration.FunctionArn" --output text --region ap-south-1
```

**Write down the output** (looks like `arn:aws:lambda:ap-south-1:639140328163:function:HIMTGetAnalytics`)

### Step 4.3: Create Integration for IngestEvents
**Replace `YOUR_API_ID` with your actual API ID from Step 4.1:**
```powershell
aws apigatewayv2 create-integration --api-id YOUR_API_ID --integration-type AWS_PROXY --integration-uri arn:aws:lambda:ap-south-1:639140328163:function:HIMTIngestEvents --payload-format-version 2.0 --region ap-south-1
```

**Write down the `IntegrationId` from the output!**

Ingest Integration ID: `_______________`

### Step 4.4: Create Integration for GetAnalytics
**Replace `YOUR_API_ID` with your actual API ID:**
```powershell
aws apigatewayv2 create-integration --api-id YOUR_API_ID --integration-type AWS_PROXY --integration-uri arn:aws:lambda:ap-south-1:639140328163:function:HIMTGetAnalytics --payload-format-version 2.0 --region ap-south-1
```

**Write down the `IntegrationId` from the output!**

Analytics Integration ID: `_______________`

### Step 4.5: Create Route for POST /events
**Replace `YOUR_API_ID` and `YOUR_INGEST_INTEGRATION_ID`:**
```powershell
aws apigatewayv2 create-route --api-id YOUR_API_ID --route-key "POST /events" --target integrations/YOUR_INGEST_INTEGRATION_ID --region ap-south-1
```

### Step 4.6: Create Route for GET /analytics
**Replace `YOUR_API_ID` and `YOUR_ANALYTICS_INTEGRATION_ID`:**
```powershell
aws apigatewayv2 create-route --api-id YOUR_API_ID --route-key "GET /analytics" --target integrations/YOUR_ANALYTICS_INTEGRATION_ID --region ap-south-1
```

### Step 4.7: Grant API Gateway Permission to Call Lambda
First get your account ID:
```powershell
aws sts get-caller-identity --query "Account" --output text
```

**Output:** `639140328163` (your account ID)

Now grant permissions (replace `YOUR_API_ID`):

**For IngestEvents:**
```powershell
aws lambda add-permission --function-name HIMTIngestEvents --statement-id AllowAPIGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:ap-south-1:639140328163:YOUR_API_ID/*" --region ap-south-1
```

**For GetAnalytics:**
```powershell
aws lambda add-permission --function-name HIMTGetAnalytics --statement-id AllowAPIGateway --action lambda:InvokeFunction --principal apigateway.amazonaws.com --source-arn "arn:aws:execute-api:ap-south-1:639140328163:YOUR_API_ID/*" --region ap-south-1
```

### Step 4.8: Deploy the API
**Replace `YOUR_API_ID`:**
```powershell
aws apigatewayv2 create-stage --api-id YOUR_API_ID --stage-name prod --auto-deploy --region ap-south-1
```

---

## Part 5: Get Your API URL (1 min)

### Step 5.1: Get the API Endpoint
**Replace `YOUR_API_ID`:**
```powershell
aws apigatewayv2 get-api --api-id YOUR_API_ID --query "ApiEndpoint" --output text --region ap-south-1
```

**Your API URL will look like:**
```
https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com
```

**⚠️ SAVE THIS URL!** You need it for:
- Extension: `modules/cloud_sync.js`
- Dashboard: `dashboard/lib/api.ts`

---

## Part 6: Test Your API (2 mins)

### Step 6.1: Test Event Ingestion
**Replace `YOUR_API_ID` in the URL:**
```powershell
Invoke-RestMethod -Uri "https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/events" -Method POST -ContentType "application/json" -Headers @{"X-Device-Id"="test-device-123"} -Body '{"events":[{"domain":"test.tracker.com","category":"advertising","riskScore":75}]}'
```

**Expected output:** `{"success":true,"processed":1,...}`

### Step 6.2: Test Analytics Retrieval
**Replace `YOUR_API_ID`:**
```powershell
Invoke-RestMethod -Uri "https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com/analytics?deviceId=test-device-123&range=7d" -Method GET
```

**Expected output:** JSON with analytics data

---

## ✅ Checkpoint

After completing these steps, you should have:
- [x] Lambda functions deployed (HIMTIngestEvents, HIMTGetAnalytics)
- [x] API Gateway created with routes (/events, /analytics)
- [x] API deployed to `prod` stage
- [x] Working API endpoints

**Your API URL:** `https://YOUR_API_ID.execute-api.ap-south-1.amazonaws.com`

**Next steps:**
1. Update `modules/cloud_sync.js` with your API URL
2. Update `dashboard/lib/api.ts` with your API URL
3. Deploy the dashboard

**Tell me when you have your API ID and I'll help update the extension code!**
