import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Hardcoding the exact UNT Green from your mockup for the active tab
        tabBarActiveTintColor: '#00853E',
        tabBarInactiveTintColor: '#A3D1B6', // A faded green for the inactive tabs
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingBottom: 5, 
        },
        tabBarLabelStyle: {
          fontWeight: 'bold', 
          fontSize: 12,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'MAP',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="map.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="lots"
        options={{
          title: 'LOTS',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ color }) => <IconSymbol size={32} name="person.crop.circle" color={color} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}