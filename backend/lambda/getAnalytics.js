// Lambda Function: Get Analytics
// Retrieves aggregated analytics data for the dashboard

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Device-Id",
    "Access-Control-Allow-Methods": "GET,OPTIONS"
};

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 200, headers: corsHeaders, body: "" };
    }

    try {
        const deviceId = event.headers["x-device-id"] || event.queryStringParameters?.deviceId;
        const range = event.queryStringParameters?.range || "7d"; // 7d or 30d

        if (!deviceId) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: "Missing deviceId" })
            };
        }

        // Calculate date range
        const days = range === "30d" ? 30 : 7;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split("T")[0];

        // Query daily stats for the date range
        const statsResult = await docClient.send(new QueryCommand({
            TableName: "DailyStats",
            KeyConditionExpression: "deviceId = :deviceId AND #date >= :startDate",
            ExpressionAttributeNames: { "#date": "date" },
            ExpressionAttributeValues: {
                ":deviceId": deviceId,
                ":startDate": startDateStr
            },
            ScanIndexForward: true // Oldest first
        }));

        const dailyStats = statsResult.Items || [];

        // Aggregate all stats
        const aggregated = aggregateStats(dailyStats);

        // Get recent tracker events (last 50) for detailed view
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        const eventsResult = await docClient.send(new QueryCommand({
            TableName: "TrackerEvents",
            KeyConditionExpression: "deviceId = :deviceId AND #ts >= :startTime",
            ExpressionAttributeNames: { "#ts": "timestamp" },
            ExpressionAttributeValues: {
                ":deviceId": deviceId,
                ":startTime": oneDayAgo
            },
            ScanIndexForward: false, // Newest first
            Limit: 100
        }));

        const recentEvents = eventsResult.Items || [];

        // Build response
        const response = {
            deviceId,
            range,
            summary: {
                totalRequests: aggregated.totalRequests,
                totalTrackers: aggregated.totalTrackers,
                blocked: aggregated.blocked,
                allowed: aggregated.allowed,
                restricted: aggregated.restricted,
                sandboxed: aggregated.sandboxed,
                privacyScore: calculatePrivacyScore(aggregated)
            },
            topCompanies: getTopN(aggregated.companies, 10),
            topCategories: getTopN(aggregated.categories, 10),
            timeline: dailyStats.map(d => ({
                date: d.date,
                requests: d.totalRequests,
                trackers: d.totalTrackers,
                blocked: d.blocked
            })),
            recentTrackers: recentEvents.slice(0, 20).map(e => ({
                domain: e.domain,
                owner: e.owner,
                category: e.category,
                riskScore: e.riskScore,
                enforcementMode: e.enforcementMode,
                timestamp: e.timestamp
            }))
        };

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(response)
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

// Aggregate multiple days of stats
function aggregateStats(dailyStats) {
    const result = {
        totalRequests: 0,
        totalTrackers: 0,
        blocked: 0,
        allowed: 0,
        restricted: 0,
        sandboxed: 0,
        categories: {},
        companies: {}
    };

    dailyStats.forEach(day => {
        result.totalRequests += day.totalRequests || 0;
        result.totalTrackers += day.totalTrackers || 0;
        result.blocked += day.blocked || 0;
        result.allowed += day.allowed || 0;
        result.restricted += day.restricted || 0;
        result.sandboxed += day.sandboxed || 0;

        // Merge categories
        if (day.categories) {
            Object.entries(day.categories).forEach(([cat, count]) => {
                result.categories[cat] = (result.categories[cat] || 0) + count;
            });
        }

        // Merge companies
        if (day.companies) {
            Object.entries(day.companies).forEach(([company, count]) => {
                result.companies[company] = (result.companies[company] || 0) + count;
            });
        }
    });

    return result;
}

// Get top N items from a count object
function getTopN(obj, n) {
    return Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([name, count]) => ({ name, count }));
}

// Calculate privacy score (0-100, higher is better)
function calculatePrivacyScore(stats) {
    if (stats.totalRequests === 0) return 100;

    const blockedRatio = (stats.blocked + stats.sandboxed) / stats.totalRequests;
    const restrictedRatio = stats.restricted / stats.totalRequests;

    // More blocking = better score
    const score = Math.round(
        (blockedRatio * 100) + (restrictedRatio * 50)
    );

    return Math.min(100, Math.max(0, score));
}
