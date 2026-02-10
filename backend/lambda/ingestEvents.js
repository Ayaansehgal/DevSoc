// Lambda Function: Ingest Tracker Events
// Receives batch events from browser extension and stores in DynamoDB

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, BatchWriteCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

// CORS headers for browser extension
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Device-Id",
    "Access-Control-Allow-Methods": "POST,OPTIONS"
};

exports.handler = async (event) => {
    // Handle CORS preflight
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    try {
        const body = JSON.parse(event.body);
        const deviceId = event.headers["x-device-id"] || body.deviceId;
        const events = body.events || [];

        if (!deviceId || events.length === 0) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: "Missing deviceId or events" })
            };
        }

        const now = Date.now();
        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        const sevenDaysFromNow = Math.floor(now / 1000) + (7 * 24 * 60 * 60);

        // Prepare batch write for TrackerEvents
        const putRequests = events.map((evt, idx) => ({
            PutRequest: {
                Item: {
                    deviceId: deviceId,
                    timestamp: now + idx, // Ensure unique sort key
                    domain: evt.domain,
                    owner: evt.owner || "Unknown",
                    category: evt.category || "Unknown",
                    riskScore: evt.riskScore || 0,
                    enforcementMode: evt.enforcementMode || "allow",
                    requestCount: evt.requestCount || 1,
                    websiteUrl: evt.websiteUrl || "",
                    contexts: evt.contexts || [],
                    expiresAt: sevenDaysFromNow // TTL - auto-delete after 7 days
                }
            }
        }));

        // Batch write (max 25 items per batch)
        const batches = [];
        for (let i = 0; i < putRequests.length; i += 25) {
            batches.push(putRequests.slice(i, i + 25));
        }

        for (const batch of batches) {
            await docClient.send(new BatchWriteCommand({
                RequestItems: { TrackerEvents: batch }
            }));
        }

        // Update daily stats (aggregation)
        const stats = aggregateEvents(events);
        await updateDailyStats(deviceId, today, stats);

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                success: true,
                message: `Stored ${events.length} events`,
                deviceId: deviceId
            })
        };

    } catch (error) {
        console.error("Error:", error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: error.message })
        };
    }
};

// Aggregate events for daily stats
function aggregateEvents(events) {
    const stats = {
        totalRequests: events.length,
        totalTrackers: new Set(events.map(e => e.domain)).size,
        blocked: events.filter(e => e.enforcementMode === "block").length,
        allowed: events.filter(e => e.enforcementMode === "allow").length,
        restricted: events.filter(e => e.enforcementMode === "restrict").length,
        sandboxed: events.filter(e => e.enforcementMode === "sandbox").length,
        categories: {},
        companies: {}
    };

    events.forEach(evt => {
        // Count by category
        const cat = evt.category || "Unknown";
        stats.categories[cat] = (stats.categories[cat] || 0) + 1;

        // Count by company/owner
        const owner = evt.owner || "Unknown";
        stats.companies[owner] = (stats.companies[owner] || 0) + 1;
    });

    return stats;
}

// Update daily stats in DynamoDB
async function updateDailyStats(deviceId, date, stats) {
    const thirtyDaysFromNow = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

    await docClient.send(new UpdateCommand({
        TableName: "DailyStats",
        Key: { deviceId, date },
        UpdateExpression: `
      SET totalRequests = if_not_exists(totalRequests, :zero) + :requests,
          totalTrackers = if_not_exists(totalTrackers, :zero) + :trackers,
          blocked = if_not_exists(blocked, :zero) + :blocked,
          allowed = if_not_exists(allowed, :zero) + :allowed,
          restricted = if_not_exists(restricted, :zero) + :restricted,
          sandboxed = if_not_exists(sandboxed, :zero) + :sandboxed,
          categories = :categories,
          companies = :companies,
          expiresAt = :expiresAt,
          updatedAt = :now
    `,
        ExpressionAttributeValues: {
            ":zero": 0,
            ":requests": stats.totalRequests,
            ":trackers": stats.totalTrackers,
            ":blocked": stats.blocked,
            ":allowed": stats.allowed,
            ":restricted": stats.restricted,
            ":sandboxed": stats.sandboxed,
            ":categories": stats.categories,
            ":companies": stats.companies,
            ":expiresAt": thirtyDaysFromNow,
            ":now": new Date().toISOString()
        }
    }));
}
