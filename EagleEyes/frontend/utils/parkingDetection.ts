import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestPermissions } from '../modules/parkzen-core';

//set once ParkZen's permission prompts have been shown on this device, so
//they aren't re-shown on every login/launch (the OS remembers the answers)
const ASKED_KEY = 'parkzen_permissions_asked';

/**
 * Shows ParkZen's permission prompts once per install (commuters only). Run after the
 * notification prompt, since the OS shows one prompt at a time.
 */
export async function askParkingPermissionsOnce(): Promise<void> {
  if (Platform.OS === 'web') return;
  if ((await AsyncStorage.getItem('role')) === 'admin') return;
  if (await AsyncStorage.getItem(ASKED_KEY)) return;
  try {
    await requestPermissions();
    await AsyncStorage.setItem(ASKED_KEY, 'true');
  } catch (error) {
    console.warn('[ParkZen] Could not request parking permissions:', error);
  }
}
