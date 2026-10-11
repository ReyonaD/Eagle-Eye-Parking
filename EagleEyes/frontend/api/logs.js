// Diagnostic logs — frontend API boundary.
//
// Sends the app's captured console output (utils/logCapture.ts) to the backend
// so we can trace bugs that only reproduce on a user's own device.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dimensions, Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiFetch } from '../utils/webCompat';
import { getCapturedLogs } from '../utils/logCapture';
import { BASE_URL } from './alerts';

function collectDeviceInfo() {
    const constants = Platform.constants || {};
    const window = Dimensions.get('window');
    return {
        // Android exposes Manufacturer/Model/Brand here; iOS exposes systemName/interfaceIdiom
        manufacturer: constants.Manufacturer,
        model: constants.Model,
        brand: constants.Brand,
        systemName: constants.systemName,
        interfaceIdiom: constants.interfaceIdiom,
        screen: `${Math.round(window.width)}x${Math.round(window.height)} @${window.scale}x`,
        executionEnvironment: Constants.executionEnvironment,
        // whether a Google Maps key made it into the JS app config (doesn't prove the
        // native manifest has a working one - see EagleMap's load-timeout warning)
        androidMapsKeyConfigured: !!Constants.expoConfig?.android?.config?.googleMaps,
        apiUrl: BASE_URL,
    };
}

// POST: Signed-in user sends their recent app logs (requires login).
export const submitLogs = async (description) => {
    const token = await AsyncStorage.getItem('token');
    try {
        const response = await apiFetch(`${BASE_URL}/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                logs: getCapturedLogs() || '(no log lines captured)',
                description: description || null,
                platform: Platform.OS,
                os_version: String(Platform.Version),
                app_version: Constants.expoConfig?.version ?? null,
                device_info: collectDeviceInfo(),
            }),
        });
        if (!response.ok) {
            const body = await response.text();
            throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return await response.json();
    } catch (error) {
        console.error("API Error (submitLogs):", error);
        throw error;
    }
};
