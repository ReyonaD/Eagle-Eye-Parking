import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';


// ─── Top Bar ───────────────────────────────────────────────────────────
function TopBar() {
  const router = useRouter();
  return (
    <View style={styles.topBar}>

      {/* Left: Logo - fixed width */}
      <View style={styles.topBarSide}>
        <Image
          source={require('../../assets/images/Logo_EagleEye.png')}
          style={styles.logo}
        />
      </View>

      {/* Center: App Name */}
      <Text style={styles.appName}>EagleEyes</Text>

      {/* Right: Bell - fixed width, same as left */}
      <View style={styles.topBarSide}>
        <TouchableOpacity style={styles.bellWrapper} onPress={() => router.push('/(tabs)/alerts')}>
          <Ionicons name="notifications-outline" size={28} color="#333" />
        </TouchableOpacity>
      </View>

    </View>
  );
}

// ─── Map Screen ────────────────────────────────────────────────────────
export default function MapScreen() {
  return (
    <View style={styles.container}>
      <TopBar />
      <View style={styles.content}>
        <Text style={styles.title}>EagleEyes Map</Text>
        <Text style={styles.subtitle}>UNT Parking map will go here!</Text>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f9f9f9' },
  content:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:      { fontSize: 32, fontWeight: 'bold', color: '#00853E', marginBottom: 10 },
  subtitle:   { fontSize: 16, color: '#666' },

  // Top Bar
topBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#eee' },
topBarSide:  { width: 50, justifyContent: 'center' },
bellWrapper: { alignItems: 'flex-end' },
logo:        { width: 100, height: 55, resizeMode: 'contain' },
appName:     { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#00853E' },
});