import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
// Make sure this path correctly points to your auth file
import { logout } from '../../api/auth'; 

export default function AdminDashboardScreen() {
  
  const handleLogout = async () => {
    await logout();
    router.replace('./login'); 
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>EagleEyes Admin</Text>
      <Text style={styles.subtitle}>Welcome to the Campus Control Center.</Text>
      <Text style={styles.info}>If you are seeing this, your Role-Based Access Control is working perfectly!</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f9f9f9' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#00853E', marginBottom: 10 },
  subtitle: { fontSize: 18, color: '#333', marginBottom: 20 },
  info: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 40, paddingHorizontal: 20 },
  logoutButton: { backgroundColor: '#D9534F', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});