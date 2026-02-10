// API Configuration and Client
// UPDATE THIS after deploying Lambda + API Gateway

export const API_CONFIG = {
    // API Gateway URL with /prod stage
    BASE_URL: 'https://5xek4j5fma.execute-api.ap-south-1.amazonaws.com/prod',

    // Storage key for device ID in localStorage
    DEVICE_ID_KEY: 'himt_device_id'
};

// Get device ID from localStorage (synced by extension content script)
export function getDeviceId(): string {
    if (typeof window === 'undefined') return '';

    const deviceId = localStorage.getItem(API_CONFIG.DEVICE_ID_KEY);
    console.log('[Dashboard API] getDeviceId:', deviceId);
    return deviceId || '';
}

// Set device ID
export function setDeviceId(deviceId: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(API_CONFIG.DEVICE_ID_KEY, deviceId);
    console.log('[Dashboard API] setDeviceId:', deviceId);
}

// Analytics response types
export interface AnalyticsData {
    deviceId: string;
    range: string;
    summary: {
        totalRequests: number;
        totalTrackers: number;
        blocked: number;
        allowed: number;
        restricted: number;
        sandboxed: number;
        privacyScore: number;
    };
    topCompanies: Array<{ name: string; count: number }>;
    topCategories: Array<{ name: string; count: number }>;
    timeline: Array<{
        date: string;
        requests: number;
        trackers: number;
        blocked: number;
    }>;
    recentTrackers: Array<{
        domain: string;
        owner: string;
        category: string;
        riskScore: number;
        enforcementMode: string;
        timestamp: number;
    }>;
}

// Fetch analytics from API - ALWAYS uses deviceId from localStorage
export async function fetchAnalytics(range: '7d' | '30d' = '7d'): Promise<AnalyticsData | null> {
    const deviceId = getDeviceId();

    console.log('[Dashboard API] Fetching analytics for deviceId:', deviceId, 'range:', range);

    if (!deviceId) {
        console.error('[Dashboard API] No device ID in localStorage! Extension may not be synced.');
        return null;
    }

    try {
        const url = `${API_CONFIG.BASE_URL}/analytics?deviceId=${deviceId}&range=${range}`;
        console.log('[Dashboard API] Fetching from:', url);

        const response = await fetch(url, {
            headers: {
                'X-Device-Id': deviceId
            }
        });

        if (!response.ok) {
            console.error('[Dashboard API] HTTP error:', response.status);
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('[Dashboard API] Received data:', data);
        return data;
    } catch (error) {
        console.error('[Dashboard API] Failed to fetch analytics:', error);
        return null;
    }
}

// Format large numbers
export function formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
}

// Get privacy grade from score
export function getPrivacyGrade(score: number): { grade: string; color: string } {
    if (score >= 80) return { grade: 'A', color: '#10b981' };
    if (score >= 60) return { grade: 'B', color: '#22c55e' };
    if (score >= 40) return { grade: 'C', color: '#f59e0b' };
    if (score >= 20) return { grade: 'D', color: '#f97316' };
    return { grade: 'F', color: '#ef4444' };
}
