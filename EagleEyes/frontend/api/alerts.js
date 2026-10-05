
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/webCompat';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
// GET: Fetch the feed (works for both tabs!)
export const getAlerts = async (alertType) => {
    try{
        const response = await apiFetch(`${BASE_URL}/alerts?alert_type=${alertType}`);
        if (!response.ok) throw new Error(`Failed to fetch ${alertType}`);
        return await response.json();
    } catch (error) {
        console.error("API Error(getAlerts):", error);
        throw error;
    }
};

// POST: Report a new hazard/event (requires login).
// Admin posts publish immediately; commuter reports go to the admin review queue.
export const createAlert = async (alertData) => {
    const token = await AsyncStorage.getItem('token');
    try{
        const response = await apiFetch(`${BASE_URL}/alerts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(alertData),
        });
        if (!response.ok) throw new Error('Failed to submit report');
        return await response.json();
    } catch (error){
        console.error("API Error (createAlert):", error);
        throw error;
    }
};

// POST: Upload one photo for a hazard/event report; call once per photo, then
// pass the returned image_urls into createAlert(). Requires login.
//
// `photo` is an expo-image-picker asset ({ uri, file? }). On native, RN's fetch
// polyfill accepts the { uri, name, type } object shape in place of a real Blob.
// On web, FormData is the browser's real implementation, which has no idea what
// that shape means — it just calls String() on it, producing the literal text
// "[object Object]" instead of a file part. expo-image-picker's web module
// already hands back the real File as `asset.file`, so use that directly there.
export const uploadAlertImage = async (photo) => {
    const token = await AsyncStorage.getItem('token');
    const formData = new FormData();

    if (photo.file) {
        formData.append('file', photo.file, photo.file.name);
    } else {
        const filename = photo.uri.split('/').pop() || `photo-${Date.now()}.jpg`;
        const extMatch = /\.(\w+)$/.exec(filename);
        const ext = (extMatch ? extMatch[1] : 'jpg').toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        formData.append('file', { uri: photo.uri, name: filename, type: mimeType });
    }

    try {
        const response = await apiFetch(`${BASE_URL}/alerts/upload-image`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                // Do not set Content-Type manually — fetch needs to add its own multipart boundary
            },
            body: formData,
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return await response.json(); // { image_url }
    } catch (error) {
        console.error("API Error (uploadAlertImage):", error);
        throw error;
    }
};

// GET: Admin review queue — commuter reports waiting for approval (admin-only)
export const getPendingAlerts = async (alertType) => {
    const token = await AsyncStorage.getItem('token');
    const response = await apiFetch(`${BASE_URL}/alerts/pending?alert_type=${alertType}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch pending reports');
    return await response.json();
};

// GET: Admin history of reports an admin declined (admin-only)
export const getDeclinedAlerts = async (alertType) => {
    const token = await AsyncStorage.getItem('token');
    const response = await apiFetch(`${BASE_URL}/alerts/declined?alert_type=${alertType}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch declined reports');
    return await response.json();
};

// PUT: Admin approves a pending report, optionally with edits (admin-only)
export const approveAlert = async (alertId, edits = {}) => {
    const token = await AsyncStorage.getItem('token');
    const response = await apiFetch(`${BASE_URL}/alerts/${alertId}/approve`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(edits),
    });
    if (!response.ok) throw new Error('Failed to approve report');
    return await response.json();
};
// DELETE: Admin declines/removes a hazard report (admin-only endpoint)
export const deleteAlert = async (alertId) => {
    const token = await AsyncStorage.getItem('token');
    console.log("deleteAlert — token present:", !!token, "| alertId:", alertId);
    try {
        const response = await apiFetch(`${BASE_URL}/alerts/${alertId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return await response.json();
    } catch (error) {
        console.error("API Error (deleteAlert):", error);
        throw error;
    }
};
// PUT: Upvote an existing alert
export const upvoteAlert = async (alertId) => {
    try{
        const response = await apiFetch(`${BASE_URL}/alerts/${alertId}/upvote`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Failed to verify alert');
        return await response.json();
    } catch (error){
        console.error("API Error (upvoteAlert):", error);
        throw error;
    }
}

// PUT: Admin acknowledges a "Note to Admin" (admin-only). Never changes
// status - a note stays 'pending' forever since it's a private message,
// not something to publish to the commuter feed.
export const acknowledgeAlert = async (alertId) => {
    const token = await AsyncStorage.getItem('token');
    try {
        const response = await apiFetch(`${BASE_URL}/alerts/${alertId}/acknowledge`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to acknowledge note');
        return await response.json();
    } catch (error) {
        console.error("API Error (acknowledgeAlert):", error);
        throw error;
    }
};