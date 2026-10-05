// Note to Admin — frontend API boundary.
//
// This file is the ONLY place Note-to-Admin screens are allowed to talk to
// the network (same isolation convention as api/alerts.js and api/auth.js).
// Notes are a separate backend model from Alerts (see app/models.py's Note
// class for why) — do not reuse /alerts or createAlert() here.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/webCompat';
import { BASE_URL } from './alerts';

// POST: Commuter submits a private note to admins (requires login).
export const createNote = async (noteData) => {
    const token = await AsyncStorage.getItem('token');
    try {
        const response = await apiFetch(`${BASE_URL}/notes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(noteData),
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return await response.json();
    } catch (error) {
        console.error("API Error (createNote):", error);
        throw error;
    }
};

// GET: Every note to admin, newest first (admin-only). The admin screen
// buckets these into Acknowledgment Pending/Active/Expired itself.
export const getNotes = async () => {
    const token = await AsyncStorage.getItem('token');
    const response = await apiFetch(`${BASE_URL}/notes`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`HTTP ${response.status}: ${body}`);
    }
    return await response.json();
};

// PUT: Admin acknowledges a note (admin-only).
export const acknowledgeNote = async (noteId) => {
    const token = await AsyncStorage.getItem('token');
    try {
        const response = await apiFetch(`${BASE_URL}/notes/${noteId}/acknowledge`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return await response.json();
    } catch (error) {
        console.error("API Error (acknowledgeNote):", error);
        throw error;
    }
};
