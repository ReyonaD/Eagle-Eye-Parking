import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Image, Text, StyleSheet } from 'react-native';

export default function AdminLayout() {
  return (
    <View style={{ flex: 1 }}>
      {/* Logo and App Name Header */}
      <View style={styles.headerContainer}>
        <Image
          source={require('../../assets/images/Logo_EagleEye.png')}
          style={styles.logoImage}
        />
        <Text style={styles.appName}>EagleEyes</Text>
      </View>

      {/* Tabs Below */}
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
          name="events"
          options={{
            title: 'EVENTS',
            tabBarIcon: ({ color }) => (
              <Ionicons name="list-outline" size={26} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="index"
          options={{
            title: 'PROFILE',
            tabBarIcon: ({ color }) => (
              <Ionicons name="home-outline" size={26} color={color} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  appName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00853E',
  },
});