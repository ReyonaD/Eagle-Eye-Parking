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

// POST: Report a new hazard/event
export const createAlert = async (alertData) => {
    try{
        const response = await fetch (`${BASE_URL}/alerts`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(alertData),
        });
        if (!response.ok) throw new Error('Failed to submit report');
        return await response.json();
    } catch (error){
        console.error("API Error (createAlert):", error);
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