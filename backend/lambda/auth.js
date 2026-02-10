// Lambda Function: User Authentication (Register & Login)
// Handles user registration and login with password hashing

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const crypto = require("crypto");

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = "Users";

// CORS headers
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
};

// Hash password with salt
function hashPassword(password, salt = null) {
    if (!salt) {
        salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

// Generate session token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.requestContext?.http?.method === "OPTIONS" || event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    try {
        const body = JSON.parse(event.body || "{}");
        const path = event.rawPath || event.path || "";

        if (path.includes("/register")) {
            return await handleRegister(body);
        } else if (path.includes("/login")) {
            return await handleLogin(body);
        } else {
            return {
                statusCode: 404,
                headers: corsHeaders,
                body: JSON.stringify({ error: "Unknown endpoint" })
            };
        }
    } catch (error) {
        console.error("Auth error:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Handle user registration
async function handleRegister(body) {
    const { email, password, deviceId } = body;

    // Validate input
    if (!email || !password) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Email and password are required" })
        };
    }

    if (password.length < 6) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Password must be at least 6 characters" })
        };
    }

    // Check if user exists
    const existing = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { email }
    }));

    if (existing.Item) {
        return {
            statusCode: 409,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Email already registered" })
        };
    }

    // Hash password
    const { hash, salt } = hashPassword(password);

    // Generate session token
    const token = generateToken();
    const tokenExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

    // Create user
    await docClient.send(new PutCommand({
        TableName: USERS_TABLE,
        Item: {
            email,
            passwordHash: hash,
            passwordSalt: salt,
            deviceIds: deviceId ? [deviceId] : [],
            createdAt: new Date().toISOString(),
            sessionToken: token,
            tokenExpiry
        }
    }));

    return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({
            success: true,
            message: "Registration successful",
            token,
            email,
            deviceIds: deviceId ? [deviceId] : []
        })
    };
}

// Handle user login
async function handleLogin(body) {
    const { email, password, deviceId } = body;

    // Validate input
    if (!email || !password) {
        return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Email and password are required" })
        };
    }

    // Get user
    const result = await docClient.send(new GetCommand({
        TableName: USERS_TABLE,
        Key: { email }
    }));

    if (!result.Item) {
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Invalid email or password" })
        };
    }

    const user = result.Item;

    // Verify password
    const { hash } = hashPassword(password, user.passwordSalt);
    if (hash !== user.passwordHash) {
        return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: "Invalid email or password" })
        };
    }

    // Generate new session token
    const token = generateToken();
    const tokenExpiry = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

    // Update user with new token and optionally add deviceId
    let deviceIds = user.deviceIds || [];
    if (deviceId && !deviceIds.includes(deviceId)) {
        deviceIds.push(deviceId);
    }

    await docClient.send(new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { email },
        UpdateExpression: "SET sessionToken = :token, tokenExpiry = :expiry, deviceIds = :devices, lastLogin = :now",
        ExpressionAttributeValues: {
            ":token": token,
            ":expiry": tokenExpiry,
            ":devices": deviceIds,
            ":now": new Date().toISOString()
        }
    }));

    return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
            success: true,
            message: "Login successful",
            token,
            email,
            deviceIds
        })
    };
}
