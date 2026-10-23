import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '../../components/TopBar'
import { useLots } from '../../context/LotsContext';

export default function TabLayout() {
  const { isDarkMap } = useLots();
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
        tabBarActiveTintColor: isDarkMap ? '#38C172' : '#00853E',
        tabBarInactiveTintColor: isDarkMap ? '#8A8A8A' : '#A3D1B6',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelPosition: Platform.select({ web: 'beside-icon', default: 'below-icon' }),
        tabBarItemStyle: Platform.select({
          web: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
        }),
        tabBarStyle: {
          backgroundColor: isDarkMap ? '#171717' : '#fff',
          borderTopColor: isDarkMap ? '#333' : '#e5e5e5',
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