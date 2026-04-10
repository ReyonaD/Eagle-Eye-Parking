import { requireNativeModule } from 'expo-modules-core';

// Grab the native Swift module directly in this file!
const ParkzenCore = requireNativeModule('ParkzenCore');
//initialize sdk using credentials
export function initializeParkZen(clientId: string, username: string, password: string): void {
  ParkzenCore.initializeParkZen(clientId, username, password);
}
// Expose the permissions function
export function requestPermissions(): void {
  return ParkzenCore.requestPermissions();
}

// Expose the location function
export async function getParkedLocation(): Promise<{latitude: number, longitude: number} | null> {
  return await ParkzenCore.getParkedLocation();
}