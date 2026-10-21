import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestPermissions } from '../modules/parkzen-core';

//set once ParkZen's permission prompts have been shown on this device, so
//they aren't re-shown on every login/launch (the OS remembers the answers)
const ASKED_KEY = 'parkzen_permissions_asked';

/**
 * Shows ParkZen's permission prompts once per install, for commuters on
 * Android. Once location is "Allow all the time", the native module configures
 * ParkZenCore, which then detects parking and sends its own notifications
 * (e.g. "how full is this lot?" on arrival). Run it after the alert
 * notification prompt has been answered: Android shows one permission prompt
 * at a time, and ParkZen asks for notification permission too.
 */
export async function askParkingPermissionsOnce(): Promise<void> {
  //iOS needs ParkZenV2.configure wired up first (see modules/parkzen-core/ios)
  if (Platform.OS !== 'android') return;
  if ((await AsyncStorage.getItem('role')) === 'admin') return;
  if (await AsyncStorage.getItem(ASKED_KEY)) return;
  try {
    await requestPermissions();
    await AsyncStorage.setItem(ASKED_KEY, 'true');
  } catch (error) {
    console.warn('[ParkZen] Could not request parking permissions:', error);
  }
}
