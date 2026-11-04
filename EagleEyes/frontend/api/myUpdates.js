// My Updates — frontend API boundary.
//
// A commuter's personal history of admin reviews: hazard reports approved or
// declined, and Notes to Admin acknowledged. Unlike the public alerts feed in
// api/alerts.js, every call here is for the logged-in user only — the backend
// scopes all of /users/me/notifications to the token's owner.

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
        throw new Error(`HTTP ${response.status}: ${body}`);
    }
};

// GET: The logged-in user's updates, newest first (read and unread).
export const getMyUpdates = async (limit = 50) => {
    try {
        const response = await apiFetch(`${BASE_URL}/users/me/notifications?limit=${limit}`, {
            headers: await authHeaders(),
        });
        await throwIfNotOk(response);
        return await response.json();
    } catch (error) {
        console.error("API Error (getMyUpdates):", error);
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
