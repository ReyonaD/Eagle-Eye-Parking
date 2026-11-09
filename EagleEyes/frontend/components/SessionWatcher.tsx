import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUser } from '../api/auth';
import { useUser } from '../context/UserContext';
import { Alert, setAuthFailureHandler } from '../utils/webCompat';
import { clearSession } from '../utils/session';

//how often a signed-in app re-checks its role with the backend while open
const CHECK_INTERVAL_MS = 15000;

/**
 * Keeps the stored role in sync with the backend, so owner changes apply without re-login:
 * demoted admins are logged out, promoted users can switch to the dashboard, and an
 * invalid token logs out. Checks every 15s, on foreground, and on any 401 / admin_revoked.
 * `ready` = root navigator mounted.
 */
export default function SessionWatcher({ ready }: { ready: boolean }) {
  const router = useRouter();
  const { refreshUser } = useUser();
  const checking = useRef(false);
  const ending = useRef(false);

  const endSession = useCallback(async (title: string, message: string) => {
    if (ending.current) return;
    ending.current = true;
    try {
      //log out first, so the user is out even if they dismiss the message
      await clearSession();
      await refreshUser();
      router.replace('/login');
      Alert.alert(title, message);
    } finally {
      ending.current = false;
    }
  }, [refreshUser, router]);

  const check = useCallback(async () => {
    if (checking.current || ending.current) return;
    const token = await AsyncStorage.getItem('token');
    if (!token) return;
    checking.current = true;
    try {
      let account: any;
      try {
        account = await getCurrentUser();
      } catch (error: any) {
        if (error?.status === 401) {
          await endSession('Session Ended', 'Your session is no longer valid. Please log in again.');
        }
        //offline / server down: try again next tick
        return;
      }

      const storedRole = await AsyncStorage.getItem('role');
      const storedOwner = (await AsyncStorage.getItem('isOwner')) === 'true';
      const isAdmin = account.role === 'admin';

      if (storedRole === 'admin' && !isAdmin) {
        await endSession(
          'Admin Access Removed',
          'An owner removed your admin access. Please log in again to keep using the app as a commuter.',
        );
        return;
      }

      if (!!account.is_owner !== storedOwner) {
        await AsyncStorage.setItem('isOwner', account.is_owner ? 'true' : 'false');
      }

      if (storedRole !== 'admin' && isAdmin) {
        await AsyncStorage.setItem('role', 'admin');
        Alert.alert(
          'Admin Access Granted',
          'You now have admin access. Switch to the admin dashboard?',
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Switch Now', onPress: () => router.replace('/(admin)' as any) },
          ],
        );
      }
    } finally {
      checking.current = false;
    }
  }, [endSession, router]);

  useEffect(() => {
    if (!ready) return;
    setAuthFailureHandler(() => { check(); });
    check();
    const intervalId = setInterval(() => {
      if (AppState.currentState === 'active') check();
    }, CHECK_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      setAuthFailureHandler(null);
      clearInterval(intervalId);
      sub.remove();
    };
  }, [check, ready]);

  return null;
}
