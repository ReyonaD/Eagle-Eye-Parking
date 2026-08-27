import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;
// GET: Fetch the feed (works for both tabs!)
export const getAlerts = async (alertType) => {
    try{
        const response = await fetch (`${BASE_URL}/alerts?alert_type=${alertType}`);
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
        const response = await fetch (`${BASE_URL}/alerts`, {
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

// GET: Admin review queue — commuter reports waiting for approval (admin-only)
export const getPendingAlerts = async (alertType) => {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${BASE_URL}/alerts/pending?alert_type=${alertType}`, {
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch pending reports');
    return await response.json();
};

// PUT: Admin approves a pending report, optionally with edits (admin-only)
export const approveAlert = async (alertId, edits = {}) => {
    const token = await AsyncStorage.getItem('token');
    const response = await fetch(`${BASE_URL}/alerts/${alertId}/approve`, {
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
        const response = await fetch(`${BASE_URL}/alerts/${alertId}`, {
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
        const response = await fetch (`${BASE_URL}/alerts/${alertId}/upvote`, {
            method: 'PUT',
        });
        if (!response.ok) throw new Error('Failed to verify alert');
        return await response.json();
    } catch (error){
        console.error("API Error (upvoteAlert):", error);
        throw error;
    }
}