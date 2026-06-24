import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Image, Text, StyleSheet } from 'react-native';

function TopBar() {
  return (
    <View style={styles.topBar}>
      {/* LEFT: Logo + App Name */}
      <View style={styles.leftGroup}>
        <Image
          source={require('../../assets/images/Logo_EagleEye.png')}
          style={styles.logo}
        />
        <Text style={styles.appNameLeft}>EagleEyes</Text>
      </View>
    </View>
  );
}

export default function AdminLayout() {
  return (
    <View style={{ flex: 1 }}>
      <TopBar />

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
            title: 'INDEX',
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 20,
    justifyContent: 'flex-start',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 90,
    height: 60,
    resizeMode: 'contain',
  },
  appNameLeft: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00853E',
    marginLeft: 8,
  },
});