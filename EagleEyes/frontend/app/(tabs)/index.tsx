import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MapScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    // Destroy the token
    await AsyncStorage.removeItem('token');
    
    // The _layout.tsx Bouncer will automatically detect the token is gone 
    // and kick you back to the login screen, but we can also manually route there:
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EagleEyes Map here!</Text>
      <Text style={styles.subtitle}>UNT Parking data will go here!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#00853E', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 40 },
  logoutButton: { backgroundColor: '#d9534f', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  logoutText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});