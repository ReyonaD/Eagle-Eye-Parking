import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

// null in Expo Go and on web, where this native module isn't built in, so
// every call below quietly does nothing there instead of crashing the app
const ParkzenCore = requireOptionalNativeModule('ParkzenCore');

//initialize sdk using credentials (iOS only: Android reads its API key and
//client ID from the build, see app.config.js)
export function initializeParkZen(clientId: string, username: string, password: string): void {
  if (Platform.OS === 'ios') ParkzenCore?.initializeParkZen(clientId, username, password);
}

// Expose the permissions function. On Android this is ParkZen's own helper:
// location, background location, activity recognition, Bluetooth and
// (Android 13+) notification permission.
export async function requestPermissions(): Promise<void> {
  await ParkzenCore?.requestPermissions();
}

// Android: ParkZenCore configures itself natively at launch and whenever the
// app returns to the foreground with permissions granted. This retries now and
// reports whether it's running.
export async function configureIfReady(): Promise<boolean> {
  if (Platform.OS !== 'android' || !ParkzenCore) return false;
  return await ParkzenCore.configureIfReady();
}

// Android testing aid: connecting to any Bluetooth device then simulates a
// vacate, and disconnecting simulates a park.
export function setTestingMode(enabled: boolean): void {
  if (Platform.OS === 'android') ParkzenCore?.setTestingMode(enabled);
}

// Expose the location function
export async function getParkedLocation(): Promise<{latitude: number, longitude: number} | null> {
  return (await ParkzenCore?.getParkedLocation()) ?? null;
}
