import AsyncStorage from '@react-native-async-storage/async-storage';
import { unregisterAlertPush } from './pushNotifications';
import { PINNED_LOTS_STORAGE_KEY } from '../app/(tabs)/lots';

/** Clears everything a logout removes. Call refreshUser() afterwards. */
export async function clearSession(): Promise<void> {
  //needs the auth token, so it has to run before it's removed
  await unregisterAlertPush();
  await AsyncStorage.multiRemove(['token', 'role', 'isOwner', PINNED_LOTS_STORAGE_KEY]);
}
