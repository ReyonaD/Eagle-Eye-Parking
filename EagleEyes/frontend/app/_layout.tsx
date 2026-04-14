import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Only run once on app initialization
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initAuth = async () => {
      try {
        // Small delay to ensure navigation is ready
        await new Promise(resolve => setTimeout(resolve, 50));

        const token = await AsyncStorage.getItem('token');
        const firstSegment = segments[0];

        // Don't redirect if we don't know where we are yet
        if (firstSegment === undefined) {
          return;
        }

        console.log('[Router] Current segment:', firstSegment, '| Has token:', !!token);

        // Only redirect if absolutely necessary
        if (!token && firstSegment === '(tabs)') {
          // User has no token but is in the main app - redirect to login
          console.log('[Router] No token in tabs, redirecting to login');
          router.replace('/login');
        } else if (token && firstSegment === 'login') {
          // User has token but is on login screen - redirect to tabs
          console.log('[Router] Has token on login, redirecting to tabs');
          router.replace('/(tabs)');
        }
        // All other cases are fine - just let the app load naturally
      } catch (error) {
        console.error('[Router] Auth initialization error:', error);
      }
    };

    initAuth();
  }, []); // Only run once on component mount

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" options={{ presentation: 'modal' }} />
    </Stack>
  );
}