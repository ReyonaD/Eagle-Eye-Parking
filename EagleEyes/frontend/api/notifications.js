// Push notifications — frontend API boundary.
//
// Registers this device's Expo push token with the backend so it gets a push
// whenever a hazard/event alert is published (see backend app/core/push.py).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/webCompat';
import { BASE_URL } from './alerts';

// POST: Start sending alert pushes to this device (requires login).
export const registerPushToken = async (pushToken, platform) => {
    const token = await AsyncStorage.getItem('token');
    const response = await apiFetch(`${BASE_URL}/users/me/push-token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ token: pushToken, platform }),
    });
    if (!response.ok) throw new Error('Failed to register for notifications');
    return await response.json();
};

// DELETE: Stop sending alert pushes to this device (requires login, so call it
// before the auth token is cleared on logout).
export const removePushToken = async (pushToken) => {
    const token = await AsyncStorage.getItem('token');
    const response = await apiFetch(`${BASE_URL}/users/me/push-token?token=${encodeURIComponent(pushToken)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to unregister from notifications');
    return await response.json();
};
