import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { registerPushToken, removePushToken } from '../api/notifications';
import { askParkingPermissionsOnce } from './parkingDetection';

//the Expo push token this device last registered with the backend, so logout
//and the Profile switch know which one to remove
const PUSH_TOKEN_KEY = 'push_token';
//'false' once the user turns notifications off in Profile; anything else = on
const PUSH_ENABLED_KEY = 'push_enabled';
//must match ANDROID_CHANNEL_ID in backend app/core/push.py
const ALERTS_CHANNEL_ID = 'alerts';

const pushSupported = Platform.OS !== 'web';

if (pushSupported) {
  //show alerts that arrive while the app is open too, not only in the background
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function isPushEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(PUSH_ENABLED_KEY)) !== 'false';
}

/**
 * Gets this device's Expo push token and registers it with the backend.
 * With prompt=false it only registers if permission was already granted, so
 * app launches never re-show the system prompt; login and the Profile switch
 * pass prompt=true. Returns whether the device is now registered.
 */
export async function registerForAlertPush({ prompt }: { prompt: boolean }): Promise<boolean> {
  if (!pushSupported || !(await isPushEnabled())) return false;
  try {
    if (Platform.OS === 'android') {
      //Android 13+ only shows the permission prompt once a channel exists
      await Notifications.setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
        name: 'Parking alerts',
        description: 'Hazards and events posted by parking admins',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && prompt) {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return false;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await registerPushToken(pushToken, Platform.OS);
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
    return true;
  } catch (error) {
    //Expo Go (Android) and simulators without push support land here
    console.warn('[Push] Could not register for alert notifications:', error);
    return false;
  }
}

/** Stops alert pushes to this device. Call before the auth token is cleared. */
export async function unregisterAlertPush(): Promise<void> {
  if (!pushSupported) return;
  const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!pushToken) return;
  try {
    await removePushToken(pushToken);
  } catch (error) {
    console.warn('[Push] Could not unregister alert notifications:', error);
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
}

/** Backs the Profile "Notifications" switch. Returns the resulting on/off state. */
export async function setPushEnabled(enabled: boolean): Promise<boolean> {
  await AsyncStorage.setItem(PUSH_ENABLED_KEY, enabled ? 'true' : 'false');
  if (!enabled) {
    await unregisterAlertPush();
    return false;
  }
  const registered = await registerForAlertPush({ prompt: true });
  if (!registered) await AsyncStorage.setItem(PUSH_ENABLED_KEY, 'false');
  return registered;
}

/**
 * Mounted once in the root layout: refreshes this device's registration on
 * launch (push tokens can change) and opens the matching alerts screen when
 * an alert notification is tapped. `ready` is the root navigator being mounted.
 */
export function useAlertPushNotifications(ready: boolean) {
  const router = useRouter();
  const registeredThisLaunch = useRef(false);

  useEffect(() => {
    if (!pushSupported || !ready) return;

    if (!registeredThisLaunch.current) {
      registeredThisLaunch.current = true;
      AsyncStorage.getItem('token').then(async (token) => {
        if (!token) return;
        await registerForAlertPush({ prompt: false });
        //sessions from before parking detection existed never saw its prompts at login
        await askParkingPermissionsOnce();
      });
    }

    const openAlert = async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as { alert_id?: number; alert_type?: string };
      //ignore anything that isn't one of our alert pushes
      if (data?.alert_id == null) return;
      if (!(await AsyncStorage.getItem('token'))) return;
      const role = await AsyncStorage.getItem('role');
      if (role === 'admin') {
        router.push(data.alert_type === 'event' ? '/(admin)/events' : '/(admin)/hazards');
      } else {
        router.push('/(tabs)/alerts');
      }
    };

    //a tap that launched the app from a killed state arrives before this
    //listener exists, so check for it once and clear it so it isn't replayed
    const launchResponse = Notifications.getLastNotificationResponse();
    if (launchResponse) {
      Notifications.clearLastNotificationResponse();
      openAlert(launchResponse);
    }
    const sub = Notifications.addNotificationResponseReceivedListener(openAlert);
    return () => sub.remove();
  }, [ready, router]);
}
