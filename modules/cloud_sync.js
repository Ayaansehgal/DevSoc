// Cloud Sync Module - Sends tracker data to AWS backend
// Handles batching, retries, and offline storage

const SYNC_CONFIG = {
    // API endpoint - with /prod stage
    API_URL: 'https://5xek4j5fma.execute-api.ap-south-1.amazonaws.com/prod',

    // Sync settings
    BATCH_SIZE: 25,
    SYNC_INTERVAL_MS: 30000,  // 30 seconds
    RETRY_DELAY_MS: 5000,
    MAX_RETRIES: 3,

    // Storage keys
    STORAGE_KEY: 'himt_pending_events',
    DEVICE_ID_KEY: 'himt_device_id',
    USER_EMAIL_KEY: 'himt_user_email'
};

class CloudSync {
    constructor() {
        this.pendingEvents = [];
        this.isSyncing = false;
        this.deviceId = null;
        this.userEmail = null;
        this.syncTimer = null;
        this.retryCount = 0;
    }

    async init() {
        try {
            const stored = await chrome.storage.local.get([
                SYNC_CONFIG.DEVICE_ID_KEY,
                SYNC_CONFIG.STORAGE_KEY,
                SYNC_CONFIG.USER_EMAIL_KEY
            ]);

            if (stored[SYNC_CONFIG.DEVICE_ID_KEY]) {
                this.deviceId = stored[SYNC_CONFIG.DEVICE_ID_KEY];
            } else {
                this.deviceId = this.generateDeviceId();
                await chrome.storage.local.set({ [SYNC_CONFIG.DEVICE_ID_KEY]: this.deviceId });
            }

            if (stored[SYNC_CONFIG.USER_EMAIL_KEY]) {
                this.userEmail = stored[SYNC_CONFIG.USER_EMAIL_KEY];
            }

            if (stored[SYNC_CONFIG.STORAGE_KEY]) {
                this.pendingEvents = stored[SYNC_CONFIG.STORAGE_KEY];
            }

            this.startPeriodicSync();
            console.log('[HIMT Cloud] Initialized with device ID:', this.deviceId);
            return true;
        } catch (error) {
            console.error('[HIMT Cloud] Init failed:', error);
            return false;
        }
    }

    // Reset data for a new account - generates new deviceId and clears all pending data
    async resetForNewAccount(email) {
        console.log('[HIMT Cloud] Resetting for new account:', email);

        // Generate new device ID for this account
        this.deviceId = this.generateDeviceId();
        this.userEmail = email;
        this.pendingEvents = [];

        // Clear all stored data and save new IDs
        await chrome.storage.local.set({
            [SYNC_CONFIG.DEVICE_ID_KEY]: this.deviceId,
            [SYNC_CONFIG.USER_EMAIL_KEY]: email,
            [SYNC_CONFIG.STORAGE_KEY]: []
        });

        console.log('[HIMT Cloud] New device ID for account:', this.deviceId);
        return this.deviceId;
    }

    // Set user email without resetting (for login to existing account)
    async setUserAccount(email, deviceId = null) {
        this.userEmail = email;

        if (deviceId) {
            // Use the deviceId from the account
            this.deviceId = deviceId;
            await chrome.storage.local.set({
                [SYNC_CONFIG.DEVICE_ID_KEY]: deviceId,
                [SYNC_CONFIG.USER_EMAIL_KEY]: email
            });
        } else {
            await chrome.storage.local.set({
                [SYNC_CONFIG.USER_EMAIL_KEY]: email
            });
        }

        console.log('[HIMT Cloud] Set user account:', email, 'deviceId:', this.deviceId);
    }

    // Get current device ID
    getDeviceId() {
        return this.deviceId;
    }

    generateDeviceId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 10);
        return `himt_${timestamp}_${random}`;
    }

    async queueEvent(trackerData) {
        const event = {
            domain: trackerData.info?.domain || trackerData.domain,
            owner: trackerData.info?.owner || trackerData.owner || 'Unknown',
            category: trackerData.info?.category || trackerData.category || 'Unknown',
            riskScore: trackerData.riskScore || 0,
            enforcementMode: trackerData.enforcementMode || 'allow',
            requestCount: trackerData.requestCount || 1,
            websiteUrl: trackerData.websiteUrl || '',
            contexts: trackerData.contexts || [],
            timestamp: Date.now()
        };

        this.pendingEvents.push(event);
        await this.savePendingEvents();

        if (this.pendingEvents.length >= SYNC_CONFIG.BATCH_SIZE) {
            this.syncNow();
        }

        return true;
    }

    async savePendingEvents() {
        try {
            await chrome.storage.local.set({ [SYNC_CONFIG.STORAGE_KEY]: this.pendingEvents });
        } catch (error) {
            console.error('[HIMT Cloud] Failed to save pending events:', error);
        }
    }

    startPeriodicSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        this.syncTimer = setInterval(() => {
            this.syncNow();
        }, SYNC_CONFIG.SYNC_INTERVAL_MS);
    }

    async syncNow() {
        if (this.isSyncing || this.pendingEvents.length === 0) {
            return;
        }

        // Check if we're online
        if (!navigator.onLine) {
            console.log('[HIMT Cloud] Offline - skipping sync');
            return;
        }

        this.isSyncing = true;

        try {
            const batch = this.pendingEvents.slice(0, SYNC_CONFIG.BATCH_SIZE);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

            const response = await fetch(`${SYNC_CONFIG.API_URL}/events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': this.deviceId
                },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    events: batch
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                this.pendingEvents = this.pendingEvents.slice(batch.length);
                await this.savePendingEvents();
                this.retryCount = 0;
                console.log(`[HIMT Cloud] Synced ${batch.length} events (${this.pendingEvents.length} remaining)`);

                if (this.pendingEvents.length >= SYNC_CONFIG.BATCH_SIZE) {
                    setTimeout(() => this.syncNow(), 100);
                }
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            // Handle different error types
            if (error.name === 'AbortError') {
                console.warn('[HIMT Cloud] Sync timeout - will retry');
            } else {
                console.error('[HIMT Cloud] Sync failed:', error.message);
            }

            this.retryCount++;
            if (this.retryCount < SYNC_CONFIG.MAX_RETRIES) {
                // Exponential backoff: 5s, 10s, 20s
                const delay = SYNC_CONFIG.RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1);
                console.log(`[HIMT Cloud] Retry ${this.retryCount}/${SYNC_CONFIG.MAX_RETRIES} in ${delay / 1000}s`);
                setTimeout(() => this.syncNow(), delay);
            } else {
                console.warn(`[HIMT Cloud] Max retries reached. ${this.pendingEvents.length} events pending.`);
                this.retryCount = 0; // Reset for next sync cycle
            }
        } finally {
            this.isSyncing = false;
        }
    }

    async getAnalytics(range = '7d') {
        try {
            const response = await fetch(
                `${SYNC_CONFIG.API_URL}/analytics?deviceId=${this.deviceId}&range=${range}`,
                { headers: { 'X-Device-Id': this.deviceId } }
            );

            if (response.ok) {
                return await response.json();
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('[HIMT Cloud] Failed to get analytics:', error);
            return null;
        }
    }

    getDeviceId() {
        return this.deviceId;
    }

    getPendingCount() {
        return this.pendingEvents.length;
    }

    async forceSync() {
        while (this.pendingEvents.length > 0) {
            await this.syncNow();
            if (this.retryCount >= SYNC_CONFIG.MAX_RETRIES) {
                break;
            }
        }
        return this.pendingEvents.length === 0;
    }
}

export const cloudSync = new CloudSync();
