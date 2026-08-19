import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
interface TopBarProps {
  role?: 'admin' | 'commuter'; 
}
export default function TopBar({ role = 'commuter' }: TopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      
      <View style={styles.leftGroup}>
        <Image
          source={require('../assets/images/Logo_EagleEye.png')}
          style={styles.logo}
        />
        <Text style={styles.appNameLeft}>EagleEyes</Text>
      </View>

      <TouchableOpacity 
        style={styles.bellWrapper} 
        onPress={() => router.push(role === 'admin' ? '/(admin)/hazards' : '/(tabs)/alerts')}
      >
        <Ionicons 
          name={role === 'admin' ? "alert-circle-outline" : "notifications-outline"} 
          size={27} 
          color={role === 'admin' ? "#D0021B" : "#333"} 
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Top Bar Container 
  topBar: { 
    flexDirection: 'row', 
    alignItems: 'center',  
    backgroundColor: '#fff', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    //paddingTop: 50, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee', 
    zIndex: 20,
    justifyContent: 'space-between' 
  },
  
  // New wrapper to keep them side-by-side on the left
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  logo: { 
    width: 90, 
    height: 60, 
    resizeMode: 'contain' 
  },
  
  appNameLeft: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#00853E',
    marginLeft: 4, // Adds a tiny gap between the logo and the text
  },
  
  bellWrapper: { 
    width: 50, 
    alignItems: 'flex-end',
    justifyContent: 'center' 
  },
});