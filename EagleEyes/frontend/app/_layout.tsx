import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LotsProvider } from '../context/LotsContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  
  // This tells us if Expo's internal navigation system has fully booted up
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // If the router isn't fully mounted yet, do absolutely nothing.
    if (!navigationState?.key) return;
     const checkAuth = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const role = await AsyncStorage.getItem('role');
        const firstSegment = segments[0];

        console.log('[Router] Current segment:', firstSegment, '| Has token:', !!token, '| Role:', role);

        // Check which "zone" the user is currently in
        const inTabsGroup = firstSegment === '(tabs)';
        const inAdminGroup = firstSegment === '(admin)';
        const inAuthGroup = firstSegment === 'login' || firstSegment === 'register';

        if (!token && (inTabsGroup || inAdminGroup)) {
          // No token, but trying to access the main app -> Kick to login
          console.log('[Router] No token! Kicking to login...');
          router.replace('./login');
        } else if (token && inAuthGroup) {
          // Has token, but sitting on the login screen -> Route based on role
          console.log('[Router] Token found! Routing based on role...');
          if (role === 'admin') {
            console.log('[Router] Admin user detected, sending to admin dashboard...');
            router.replace('./(admin)');
          } else {
            console.log('[Router] Regular user detected, sending to map...');
            router.replace('./(tabs)');
          }
        }
      } catch (error) {
        console.error('[Router] Auth initialization error:', error);
      }
    };

    checkAuth();
  }, [segments, navigationState?.key]);
//automatically re-check auth status whenever the route changes or when navigation state initializes
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LotsProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" options={{ presentation: 'modal' }} />
        </Stack>
      </LotsProvider>
    </GestureHandlerRootView>
  );
}