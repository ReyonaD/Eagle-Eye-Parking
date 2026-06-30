import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Image, Text, StyleSheet } from 'react-native';
import TopBar from '../../components/TopBar';
// function TopBar() {
//   return (
//     <View style={styles.topBar}>
//       {/* LEFT: Logo + App Name */}
//       <View style={styles.leftGroup}>
//         <Image
//           source={require('../../assets/images/Logo_EagleEye.png')}
//           style={styles.logo}
//         />
//         <Text style={styles.appNameLeft}>EagleEyes</Text>
//       </View>
//     </View>
//   );
// }

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
          tabBarStyle: { paddingTop: 5 },
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
  
});