import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AdminLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#00853E',
        tabBarInactiveTintColor: '#A3D1B6',
        tabBarLabelStyle: { fontWeight: 'bold', fontSize: 12 },
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
        name="event"
        options={{
          title: 'EVENT',
          tabBarIcon: ({ color }) => (
            <Ionicons name="list-outline" size={26} color={color} />
          ),
        }}
      />

    </Tabs>
  );
}
