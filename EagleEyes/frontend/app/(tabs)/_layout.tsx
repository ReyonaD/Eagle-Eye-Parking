import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';


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
          tabBarIcon: ({ color }) => <Ionicons name="map-outline" size={25} color={color} />,
        }}
      />
      <Tabs.Screen
        name="lots"
        options={{
          title: 'LOTS',
          tabBarIcon: ({ color }) => <Ionicons name="list-outline" size={25} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={25} color={color} />,
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