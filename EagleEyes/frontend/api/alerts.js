
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/webCompat';
import { findActiveClosures } from '../utils/lotStatus';

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Error with the backend's `detail` message and HTTP status.
const errorFromResponse = async (response, fallback) => {
    let detail = null;
    try {
        const data = await response.json();
        if (typeof data?.detail === 'string') detail = data.detail;
    } catch {
        // not JSON - keep the fallback message
    }
    const error = new Error(detail || fallback);
    error.status = response.status;
    error.detail = detail;
    return error;
};
// GET: Fetch the feed (works for both tabs!)
export const getAlerts = async (alertType) => {
    try{
        // the feed is public; logged-in admins also get each report's reporter emails
        const token = await AsyncStorage.getItem('token');
        const response = await apiFetch(`${BASE_URL}/alerts?alert_type=${alertType}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
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
        if (!response.ok) throw await errorFromResponse(response, 'Failed to submit report');
        return await response.json();
    } catch (error){
        console.error("API Error (createAlert):", error);
        throw error;
    }
};

// POST: upload one report photo (requires login); returns { image_url }.
// On web, FormData needs the real File (asset.file), not the native { uri } shape.
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
    if (!response.ok) throw await errorFromResponse(response, 'Failed to approve report');
    return await response.json();
};
// PUT: Admin takes a published hazard off the map/lots (active=false) or puts
// it back up (active=true). Unlike deleteAlert, it stays in history.
export const setHazardActive = async (alertId, active) => {
    const token = await AsyncStorage.getItem('token');
    const response = await apiFetch(`${BASE_URL}/alerts/${alertId}/active`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ active }),
    });
    if (!response.ok) throw new Error('Failed to update hazard');
    return await response.json();
};
// PUT: Admin edits an event's details (admin-only). Sends the whole edited
// event; event_end: null saves it with no end date.
export const updateEvent = async (alertId, eventData) => {
    const token = await AsyncStorage.getItem('token');
    const response = await apiFetch(`${BASE_URL}/alerts/${alertId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(eventData),
    });
    if (!response.ok) throw await errorFromResponse(response, 'Failed to update event');
    return await response.json();
};
// DELETE: Admin declines/removes a hazard report (admin-only endpoint)
export const deleteAlert = async (alertId) => {
    const token = await AsyncStorage.getItem('token');
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
// PUT: Confirm an existing alert (requires login; each account counts once)
export const upvoteAlert = async (alertId) => {
    const token = await AsyncStorage.getItem('token');
    try{
        const response = await apiFetch(`${BASE_URL}/alerts/${alertId}/upvote`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Failed to verify alert');
        return await response.json();
    } catch (error){
        console.error("API Error (upvoteAlert):", error);
        throw error;
    }
}
// Whether `lotName` is closed right now, checked against freshly fetched
// events. `fallback` is used when the request fails (e.g. offline).
export const isLotClosedNow = async (lotName, fallback = false) => {
    if (!lotName) return false;
    try {
        return findActiveClosures(await getAlerts('event'), lotName).length > 0;
    } catch {
        return fallback;
    }
};
