// Note Status API: the logged-in user's own notes and acknowledgment updates.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/webCompat';
import { BASE_URL } from './alerts';

const authHeaders = async () => {
    const token = await AsyncStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}` };
};

const throwIfNotOk = async (response) => {
    if (!response.ok) {
        const body = await response.text();
        const error = new Error(`HTTP ${response.status}: ${body}`);
        error.status = response.status;
        throw error;
    }
};

// GET: The logged-in user's own notes, newest first, with acknowledged_at
// (null = still pending). Skips the request when nobody (or an admin) is logged in.
export const getMyNotes = async () => {
    const [token, role] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('role'),
    ]);
    if (!token || role === 'admin') return [];
    try {
        const response = await apiFetch(`${BASE_URL}/users/me/notes`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        await throwIfNotOk(response);
        return await response.json();
    } catch (error) {
        if (error.status !== 401) {
            console.error("API Error (getMyNotes):", error);
        }
        throw error;
    }
};

// GET: The logged-in user's updates, newest first (read and unread).
// Like the unread count, skips the request when nobody (or an admin) is logged in.
export const getMyUpdates = async (limit = 50) => {
    const [token, role] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('role'),
    ]);
    if (!token || role === 'admin') return [];
    try {
        const response = await apiFetch(`${BASE_URL}/users/me/notifications?limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        await throwIfNotOk(response);
        return await response.json();
    } catch (error) {
        //an expired/foreign token is expected after switching backends; the
        //screen still shows its error state, it just doesn't spam the console
        if (error.status !== 401) {
            console.error("API Error (getMyUpdates):", error);
        }
        throw error;
    }
};

// GET: How many updates are unread. Polled for the bell and tab badges, so it
// skips the request entirely when nobody (or an admin) is logged in.
export const getMyUpdatesUnreadCount = async () => {
    const [token, role] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('role'),
    ]);
    if (!token || role === 'admin') return 0;
    const response = await apiFetch(`${BASE_URL}/users/me/notifications/unread-count`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    await throwIfNotOk(response);
    const data = await response.json();
    return data.count ?? 0;
};

// PUT: Mark one update as read. Safe to call again on an already-read one.
export const markMyUpdateRead = async (notificationId) => {
    try {
        const response = await apiFetch(`${BASE_URL}/users/me/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: await authHeaders(),
        });
        await throwIfNotOk(response);
        return await response.json();
    } catch (error) {
        console.error("API Error (markMyUpdateRead):", error);
        throw error;
    }
};

// PUT: Mark every update as read. History is kept, only the unread state changes.
export const markAllMyUpdatesRead = async () => {
    try {
        const response = await apiFetch(`${BASE_URL}/users/me/notifications/read-all`, {
            method: 'PUT',
            headers: await authHeaders(),
        });
        await throwIfNotOk(response);
        return await response.json();
    } catch (error) {
        console.error("API Error (markAllMyUpdatesRead):", error);
        throw error;
    }
};
