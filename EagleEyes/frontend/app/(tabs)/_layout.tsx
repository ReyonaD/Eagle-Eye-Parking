import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '../../components/TopBar'

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // Alerts has its own back button + title, so the brand topbar (logo + bell)
  // would just stack redundant chrome above it — hide it on that screen only.
  const pathname = usePathname();
  const showTopBar = pathname !== '/alerts';

  return (
    <View style={{ flex: 1 }}>
          {showTopBar && <TopBar role="commuter" />}
    <Tabs
      screenOptions={{
        // Hardcoding the exact UNT Green from your mockup for the active tab
        tabBarActiveTintColor: '#00853E',
        tabBarInactiveTintColor: '#A3D1B6', // A faded green for the inactive tabs
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelPosition: Platform.select({ web: 'beside-icon', default: 'below-icon' }),
        tabBarItemStyle: Platform.select({
          web: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
        }),
        tabBarStyle: {
          ...Platform.select({
            web: { height: 82, paddingBottom: 10, paddingTop: 10 },
            default: { paddingBottom: 5, paddingTop: 5 },
          }),
        },
        tabBarLabelStyle: {
          fontWeight: 'bold', 
          fontSize: Platform.select({ web: 15, default: 12 }),
          ...Platform.select({ web: { marginTop: 0, marginLeft: 8 } }),
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'MAP',
          tabBarIcon: ({ color }) => (
            <View style={{ transform: [{ translateY: Platform.OS === 'web' ? 0 : 4 }] }}>
              <Ionicons name="map-outline" size={27} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="lots"
        options={{
          title: 'LOTS',
          tabBarIcon: ({ color }) => (
            <View style={{ transform: [{ translateY: Platform.OS === 'web' ? 0 : 4 }] }}>
              <Ionicons name="list-outline" size={27} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PROFILE',
          tabBarIcon: ({ color }) => (
            <View style={{ transform: [{ translateY: Platform.OS === 'web' ? 0 : 4 }] }}>
              <Ionicons name="person-outline" size={27} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
        }}
      />
    </Tabs>
    </View>
  );
}