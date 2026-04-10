import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments(); // Get the current route segments to determine where the user is in the app

  useEffect(() => {
    const checkAuth = async () => {
      // Check if the token exists in storage
      const token = await AsyncStorage.getItem('token');
      
      // Check if the user is currently inside the (tabs) folder
      const inTabsGroup = segments[0] === '(tabs)';

      // The Routing Logic
      if (token && !inTabsGroup) {
        // Logged in. Send to the map!
        router.replace('/(tabs)');
      } else if (!token && inTabsGroup) {
        // Not logged in, remain there
        router.replace('/login');
      }
    };

    checkAuth();
  }, [segments]); // Run this check every time the user changes screens

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Tell Expo about all our main routes */}
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" options={{ presentation: 'modal' }} />
    </Stack>
  );
}