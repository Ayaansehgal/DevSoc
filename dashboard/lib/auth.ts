// Auth API Configuration and Client
import { API_CONFIG } from './api';

export interface AuthResponse {
    success: boolean;
    message: string;
    token?: string;
    email?: string;
    deviceIds?: string[];
    error?: string;
}

export interface User {
    email: string;
    token: string;
    deviceIds: string[];
}

const AUTH_STORAGE_KEY = 'himt_auth';
const DEVICE_ID_KEY = 'himt_device_id';

// Get stored auth
export function getStoredAuth(): User | null {
    if (typeof window === 'undefined') return null;

    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    try {
        const user = JSON.parse(stored);
        return user;
    } catch {
        return null;
    }
}

// Store auth
export function storeAuth(user: User): void {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

// Clear auth
export function clearAuth(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
}

// Check if logged in
export function isLoggedIn(): boolean {
    return getStoredAuth() !== null;
}

// Generate a fresh deviceId
function generateDeviceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `himt_${timestamp}_${random}`;
}

// Register new user - creates FRESH deviceId for new account (starts from 0)
export async function register(email: string, password: string): Promise<AuthResponse> {
    try {
        // Generate a BRAND NEW deviceId for this new account
        // This ensures the new account starts with 0 data
        const newDeviceId = generateDeviceId();
        console.log('[Auth] Registering with NEW deviceId:', newDeviceId);

        // Save the new deviceId to localStorage FIRST
        // This makes the extension start using it immediately
        localStorage.setItem(DEVICE_ID_KEY, newDeviceId);

        const response = await fetch(`${API_CONFIG.BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                deviceId: newDeviceId
            })
        });

        const data = await response.json();

        if (data.success && data.token) {
            storeAuth({
                email: data.email,
                token: data.token,
                deviceIds: [newDeviceId]  // Store the new deviceId
            });
            console.log('[Auth] Registration successful, deviceId:', newDeviceId);
        }

        return data;
    } catch (error) {
        return { success: false, message: 'Network error', error: String(error) };
    }
}

// Login - uses the account's saved deviceId
export async function login(email: string, password: string): Promise<AuthResponse> {
    try {
        // Get current deviceId (might be from previous login)
        const currentDeviceId = localStorage.getItem(DEVICE_ID_KEY);
        console.log('[Auth] Logging in, current deviceId:', currentDeviceId);

        const response = await fetch(`${API_CONFIG.BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                deviceId: currentDeviceId
            })
        });

        const data = await response.json();

        if (data.success && data.token) {
            // Use the FIRST deviceId from the account (the one used during registration)
            const accountDeviceId = data.deviceIds?.[0];

            if (accountDeviceId) {
                // Update localStorage to use this account's deviceId
                localStorage.setItem(DEVICE_ID_KEY, accountDeviceId);
                console.log('[Auth] Login successful, switched to account deviceId:', accountDeviceId);
            }

            storeAuth({
                email: data.email,
                token: data.token,
                deviceIds: data.deviceIds || []
            });
        }

        return data;
    } catch (error) {
        return { success: false, message: 'Network error', error: String(error) };
    }
}

// Logout - clears auth but keeps deviceId for extension to work
export function logout(): void {
    clearAuth();
    console.log('[Auth] Logged out');
}
