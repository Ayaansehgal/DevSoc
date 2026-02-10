# User Authentication - AWS Deployment Guide

This guide covers deploying the authentication system for the HIMT dashboard.

## 1. Create Users DynamoDB Table

```powershell
aws dynamodb create-table `
    --table-name Users `
    --attribute-definitions AttributeName=email,AttributeType=S `
    --key-schema AttributeName=email,KeyType=HASH `
    --billing-mode PAY_PER_REQUEST `
    --region ap-south-1
```

## 2. Deploy Auth Lambda Function

### 2.1. Prepare Lambda Package

```powershell
# Navigate to lambda directory
cd backend\lambda

# Create temp folder
mkdir auth-package

# Copy auth.js
copy auth.js auth-package\index.js

# Create package.json
@"
{
  "name": "himt-auth",
  "version": "1.0.0",
  "dependencies": {
    "@aws-sdk/client-dynamodb": "^3.400.0",
    "@aws-sdk/lib-dynamodb": "^3.400.0"
  }
}
"@ | Out-File -Encoding utf8 auth-package\package.json

# Install dependencies
cd auth-package
npm install

# Create zip
Compress-Archive -Path * -DestinationPath ..\auth.zip -Force
cd ..

# Cleanup
Remove-Item -Recurse -Force auth-package
```

### 2.2. Create Lambda Function

```powershell
aws lambda create-function `
    --function-name HIMTAuth `
    --runtime nodejs18.x `
    --role arn:aws:iam::639140328163:role/HIMTLambdaRole `
    --handler index.handler `
    --zip-file fileb://auth.zip `
    --timeout 10 `
    --memory-size 256 `
    --region ap-south-1
```

### 2.3. Update Lambda (if already exists)

```powershell
aws lambda update-function-code `
    --function-name HIMTAuth `
    --zip-file fileb://auth.zip `
    --region ap-south-1
```

## 3. Add API Gateway Routes

Using your existing API Gateway (`5xek4j5fma`):

### 3.1. Create Lambda Integration

```powershell
aws apigatewayv2 create-integration `
    --api-id 5xek4j5fma `
    --integration-type AWS_PROXY `
    --integration-uri arn:aws:lambda:ap-south-1:639140328163:function:HIMTAuth `
    --payload-format-version 2.0 `
    --region ap-south-1
```

Save the `IntegrationId` from the output.

### 3.2. Create Routes

Replace `{INTEGRATION_ID}` with the ID from above:

```powershell
# Register route
aws apigatewayv2 create-route `
    --api-id 5xek4j5fma `
    --route-key "POST /register" `
    --target integrations/{INTEGRATION_ID} `
    --region ap-south-1

# Login route
aws apigatewayv2 create-route `
    --api-id 5xek4j5fma `
    --route-key "POST /login" `
    --target integrations/{INTEGRATION_ID} `
    --region ap-south-1
```

### 3.3. Add Lambda Permission

```powershell
aws lambda add-permission `
    --function-name HIMTAuth `
    --statement-id apigateway-auth `
    --action lambda:InvokeFunction `
    --principal apigateway.amazonaws.com `
    --source-arn "arn:aws:execute-api:ap-south-1:639140328163:5xek4j5fma/*/*" `
    --region ap-south-1
```

## 4. Test the Endpoints

### Test Registration

```powershell
Invoke-RestMethod `
    -Uri "https://5xek4j5fma.execute-api.ap-south-1.amazonaws.com/prod/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"test@example.com","password":"password123"}'
```

### Test Login

```powershell
Invoke-RestMethod `
    -Uri "https://5xek4j5fma.execute-api.ap-south-1.amazonaws.com/prod/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"test@example.com","password":"password123"}'
```

## 5. Dashboard Usage

After deployment:

1. Navigate to your dashboard URL
2. You'll be redirected to the login page
3. Create an account or sign in
4. Your device ID will be linked to your account
5. Analytics will be filtered by your linked device IDs

## Security Notes

- Passwords are hashed using PBKDF2 with 10,000 iterations
- Session tokens expire after 7 days
- All passwords require a minimum of 6 characters
- Device IDs are linked to accounts for cross-device analytics
