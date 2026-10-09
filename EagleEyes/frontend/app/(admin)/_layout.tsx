import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, Image, Text, StyleSheet } from 'react-native';
import TopBar from '../../components/TopBar';

export default function AdminLayout() {
  return (
    <View style={{ flex: 1 }}>
      <TopBar role="admin" />

      {/* Tabs Below */}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#00853E',
          tabBarInactiveTintColor: '#A3D1B6',
          tabBarLabelPosition: Platform.select({ web: 'beside-icon', default: 'below-icon' }),
          tabBarItemStyle: Platform.select({
            web: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
          }),
          tabBarLabelStyle: {
            fontWeight: 'bold',
            fontSize: Platform.select({ web: 15, default: 12 }),
            ...Platform.select({ web: { marginTop: 0, marginLeft: 8 } }),
          },
          tabBarStyle: {
            ...Platform.select({
              web: { height: 82, paddingBottom: 10, paddingTop: 10 },
              default: { paddingTop: 5 },
            }),
          },
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

        {/* Hidden screens — navigable via router.push but not shown in tab bar */}
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
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  
});