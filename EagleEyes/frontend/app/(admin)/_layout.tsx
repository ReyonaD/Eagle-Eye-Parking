import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import TopBar from '../../components/TopBar';
import AdminSidebar from '../../components/AdminSidebar';
import { AdminNotesBadgeProvider } from '../../context/AdminNotesBadgeContext';

const IS_WEB = Platform.OS === 'web';

export default function AdminLayout() {
  //web only - mobile keeps the normal bottom tab bar, untouched
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AdminNotesBadgeProvider>
    <View style={{ flex: 1 }}>
      <TopBar role="admin" />

      <View style={IS_WEB ? styles.webBody : styles.mobileBody}>
        {IS_WEB && (
          <AdminSidebar
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed(c => !c)}
          />
        )}

        <View style={styles.content}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#00853E',
              tabBarInactiveTintColor: '#A3D1B6',
              tabBarLabelStyle: { fontWeight: 'bold', fontSize: 12 },
              //on web, navigation moved to the sidebar above - hide the bottom bar
              //but keep this a Tabs navigator so router.push between screens still works
              tabBarStyle: IS_WEB ? { display: 'none' } : { paddingTop: 5 },
            }}
          >
            <Tabs.Screen
              name="hazards"
              options={{
                title: 'HAZARDS',
                tabBarIcon: ({ color }) => (
                  <Ionicons name="warning-outline" size={26} color={color} />
                ),
              }}
            />

            <Tabs.Screen
              name="events"
              options={{
                title: 'EVENTS',
                tabBarIcon: ({ color }) => (
                  <Ionicons name="list-outline" size={26} color={color} />
                ),
              }}
            />

            <Tabs.Screen
              name="profile"
              options={{
                title: 'PROFILE',
                tabBarIcon: ({ color }) => (
                  <Ionicons name="home-outline" size={26} color={color} />
                ),
              }}
            />

            <Tabs.Screen
              name="index"
              options={{ href: null }}
            />

            {/* Hidden screens — navigable via router.push but not shown in tab bar/sidebar */}
            <Tabs.Screen
              name="post-alert"
              options={{ href: null }}
            />

            <Tabs.Screen
              name="admin-management"
              options={{ href: null }}
            />

            <Tabs.Screen
              name="commuter-notes"
              options={{ href: null }}
            />

            <Tabs.Screen
              name="past-events"
              options={{ href: null }}
            />

            <Tabs.Screen
              name="hazard-history"
              options={{ href: null }}
            />

            <Tabs.Screen
              name="notes-history"
              options={{ href: null }}
            />
          </Tabs>
        </View>
      </View>
    </View>
    </AdminNotesBadgeProvider>
  );
}

const styles = StyleSheet.create({
  mobileBody: { flex: 1 },
  webBody: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
});
