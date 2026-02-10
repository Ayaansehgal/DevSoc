# AWS Account & Infrastructure Setup Guide

Complete step-by-step guide to set up AWS for the tracker dashboard.

---

## Part 1: Create AWS Account (10 mins)

### Step 1.1: Sign Up
1. Go to https://aws.amazon.com/free
2. Click **"Create a Free Account"**
3. Enter your email and create a password
4. Choose **"Personal"** account type
5. Fill in contact information
6. Enter credit/debit card (you won't be charged - it's for verification only)
7. Complete phone verification with OTP
8. Select **"Basic Support - Free"**
9. Click **"Complete Sign Up"**

### Step 1.2: Wait for Activation
- AWS account activation takes 1-24 hours (usually within minutes)
- You'll receive an email when ready[]

---

## Part 2: Secure Your Account (5 mins)

### Step 2.1: Enable MFA on Root Account
1. Sign in at https://console.aws.amazon.com
2. Click your account name (top right) → **Security credentials**
3. Under "Multi-factor authentication" → **Assign MFA device**
4. Choose **Authenticator app**
5. Scan QR code with Google Authenticator or Authy
6. Enter two consecutive codes and click **Add MFA**

---

## Part 3: Create IAM User (5 mins)

> [!IMPORTANT]
> Never use root account for daily work. Create an IAM user instead.

### Step 3.1: Create Admin User
1. Search **"IAM"** in the top search bar → Open IAM
2. Left menu → **Users** → **Create user**
3. User name: `himt-admin`
4. Check ✅ **Provide user access to the AWS Management Console**
5. Select **I want to create an IAM user**
6. Choose **Custom password** → Enter a strong password
7. Uncheck "User must create new password"
8. Click **Next**
9. Select **Attach policies directly**
10. Search and check ✅ **AdministratorAccess**
11. Click **Next** → **Create user**
12. **IMPORTANT**: Copy and save the Console sign-in URL

### Step 3.2: Sign Out and Sign In as IAM User
1. Sign out of root account
2. Use the Console sign-in URL you saved
3. Enter `himt-admin` and your password

---

## Part 4: Install AWS CLI (5 mins)

### Step 4.1: Open PowerShell as Administrator
1. Press **Windows key**
2. Type `powershell`
3. Right-click on **Windows PowerShell**
4. Click **Run as administrator**
5. Click **Yes** when prompted

### Step 4.2: Download AWS CLI Installer
Copy and paste this EXACT command (one line):
```powershell
Invoke-WebRequest -Uri "https://awscli.amazonaws.com/AWSCLIV2.msi" -OutFile "C:\AWSCLIV2.msi"
```

**Wait for download to complete** (about 30 seconds). You'll see a progress bar.

### Step 4.3: Install AWS CLI
Copy and paste this EXACT command:
```powershell
Start-Process msiexec.exe -Wait -ArgumentList "/i C:\AWSCLIV2.msi /quiet"
```

**Wait about 1-2 minutes**. No output means success.

### Step 4.4: Close and Reopen PowerShell
1. Type `exit` and press Enter to close PowerShell
2. Open a NEW PowerShell window (doesn't need to be Administrator now)

### Step 4.5: Verify AWS CLI Installation
Copy and paste:
```powershell
aws --version
```

**Expected output** (version numbers may differ):
```
aws-cli/2.15.0 Python/3.11.6 Windows/10 exe/AMD64
```

If you see "aws is not recognized", restart your computer and try again.

---

## Part 4B: Create Access Keys in AWS Console

### Step 4B.1: Go to IAM Users
1. Open browser: https://console.aws.amazon.com
2. Sign in as `himt-admin` (NOT root account)
3. In the search bar at top, type `IAM` and click the result
4. In the left menu, click **Users**
5. Click on **himt-admin**

### Step 4B.2: Create Access Key
1. Click the **Security credentials** tab
2. Scroll down to **Access keys** section
3. Click **Create access key** button
4. Select **Command Line Interface (CLI)**
5. Check the box "I understand the above recommendation..."
6. Click **Next**
7. Click **Create access key**

### Step 4B.3: IMPORTANT - Save Your Keys
**You will only see these keys ONCE!**

1. Click **Download .csv file** button
2. Save the file somewhere safe (e.g., Desktop)
3. Open the CSV file - you'll see:
   - Access key ID (looks like: `AKIAIOSFODNN7EXAMPLE`)
   - Secret access key (looks like: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)

### Step 4B.4: Configure AWS CLI
In PowerShell, type:
```powershell
aws configure
```

The CLI will ask 4 questions. Enter exactly as shown:

**Question 1:** `AWS Access Key ID [None]:`
→ Paste your Access Key ID from the CSV, press Enter

**Question 2:** `AWS Secret Access Key [None]:`
→ Paste your Secret Access Key from the CSV, press Enter

**Question 3:** `Default region name [None]:`
→ Type exactly: `ap-south-1` press Enter

**Question 4:** `Default output format [None]:`
→ Type exactly: `json` press Enter

### Step 4B.5: Verify Configuration Works
Copy and paste:
```powershell
aws sts get-caller-identity
```

**Expected output:**
```json
{
    "UserId": "AIDAEXAMPLEID",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/himt-admin"
}
```

If you see an error, re-run `aws configure` and enter the keys again carefully.

---

## Part 5: Create DynamoDB Tables (5 mins)

### Step 5.1: Create TrackerEvents Table
Copy and paste this ENTIRE command as ONE line:
```powershell
aws dynamodb create-table --table-name TrackerEvents --attribute-definitions AttributeName=deviceId,AttributeType=S AttributeName=timestamp,AttributeType=N --key-schema AttributeName=deviceId,KeyType=HASH AttributeName=timestamp,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region ap-south-1
```

**Expected output:** Long JSON with `"TableStatus": "CREATING"`

### Step 5.2: Wait for Table to be Active
Wait 30 seconds, then check status:
```powershell
aws dynamodb describe-table --table-name TrackerEvents --region ap-south-1 --query "Table.TableStatus" 
```

**Expected output:** `"ACTIVE"`

If it shows `"CREATING"`, wait 15 more seconds and try again.

### Step 5.3: Enable Auto-Delete (TTL) for TrackerEvents
Copy and paste:
```powershell
aws dynamodb update-time-to-live --table-name TrackerEvents --time-to-live-specification Enabled=true,AttributeName=expiresAt --region ap-south-1
```

**Expected output:** JSON with `"TimeToLiveStatus": "ENABLING"`

### Step 5.4: Create DailyStats Table
Copy and paste this ENTIRE command as ONE line:
```powershell
aws dynamodb create-table --table-name DailyStats --attribute-definitions AttributeName=deviceId,AttributeType=S AttributeName=date,AttributeType=S --key-schema AttributeName=deviceId,KeyType=HASH AttributeName=date,KeyType=RANGE --billing-mode PAY_PER_REQUEST --region ap-south-1
```

### Step 5.5: Wait 30 Seconds, Then Enable TTL for DailyStats
```powershell
aws dynamodb update-time-to-live --table-name DailyStats --time-to-live-specification Enabled=true,AttributeName=expiresAt --region ap-south-1
```

### Step 5.6: Verify Both Tables Exist
```powershell
aws dynamodb list-tables --region ap-south-1
```

**Expected output:**
```json
{
    "TableNames": [
        "DailyStats",
        "TrackerEvents"
    ]
}
```

---

## Part 6: Create Lambda Role (3 mins)

### Step 6.1: Create the Trust Policy File
Copy and paste this command (it's all one line):
```powershell
'{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' | Out-File -FilePath "$env:TEMP\trust-policy.json" -Encoding ASCII
```

**No output = success**. The file is created in your temp folder.

### Step 6.2: Create the IAM Role
Copy and paste:
```powershell
aws iam create-role --role-name HIMTLambdaRole --assume-role-policy-document file://$env:TEMP\trust-policy.json
```

**Expected output:** JSON with role details including `"RoleName": "HIMTLambdaRole"`

### Step 6.3: Attach Lambda Execution Policy
Copy and paste:
```powershell
aws iam attach-role-policy --role-name HIMTLambdaRole --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

**No output = success**

### Step 6.4: Attach DynamoDB Access Policy
Copy and paste:
```powershell
aws iam attach-role-policy --role-name HIMTLambdaRole --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
```

**No output = success**

### Step 6.5: Get and Save the Role ARN
Copy and paste:
```powershell
aws iam get-role --role-name HIMTLambdaRole --query "Role.Arn" --output text
```

**Expected output** (your numbers will be different):
```
arn:aws:iam::123456789012:role/HIMTLambdaRole
```

**COPY THIS ARN AND SAVE IT** - You'll need it for Lambda deployment!

### Step 6.6: Clean Up Temp File (Optional)
```powershell
Remove-Item "$env:TEMP\trust-policy.json"
```

---

## ✅ Checkpoint

Run these commands to verify everything is set up:

```powershell
# Check AWS CLI
aws --version

# Check identity
aws sts get-caller-identity

# Check tables
aws dynamodb list-tables --region ap-south-1

# Check role
aws iam get-role --role-name HIMTLambdaRole --query "Role.Arn" --output text
```

**All commands should succeed without errors.**

After completing Parts 1-6, you should have:
- [x] AWS account activated
- [x] MFA enabled on root
- [x] IAM user `himt-admin` created
- [x] AWS CLI installed and configured
- [x] DynamoDB tables created (TrackerEvents, DailyStats)
- [x] Lambda role created (HIMTLambdaRole)
- [x] Role ARN saved (you'll need this!)

**Tell me when you've completed these steps and I'll help with Lambda deployment!**

