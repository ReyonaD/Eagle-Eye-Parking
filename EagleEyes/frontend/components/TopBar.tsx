import React from 'react';
import { Platform, View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
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
    <View
      style={[
        styles.topBar,
        Platform.select({ web: styles.webTopBar }),
        { paddingTop: insets.top },
      ]}
    >
      
      <View style={styles.leftGroup}>
        <Image
          source={require('../assets/images/Logo_EagleEye.png')}
          style={[styles.logo, Platform.select({ web: styles.webLogo })]}
        />
        <Text style={[styles.appNameLeft, Platform.select({ web: styles.webAppName })]}>EagleEyes</Text>
      </View>

      {role === 'admin' ? (
        <TouchableOpacity
          style={[styles.bellWrapper, Platform.select({ web: styles.webBellWrapper })]}
          onPress={() => router.push('/(admin)/commuter-notes')}
          accessibilityLabel="Notes from Commuters"
        >
          <Ionicons name="document-text-outline" size={Platform.select({ web: 34, default: 27 })} color="#333" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.bellWrapper, Platform.select({ web: styles.webBellWrapper })]}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <Ionicons name="notifications-outline" size={Platform.select({ web: 34, default: 27 })} color="#333" />
        </TouchableOpacity>
      )}
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
  webTopBar: {
    minHeight: 104,
    paddingHorizontal: 24,
    paddingVertical: 12,
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
  webLogo: {
    width: 126,
    height: 78,
  },
  
  appNameLeft: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#00853E',
    marginLeft: 4, // Adds a tiny gap between the logo and the text
  },
  webAppName: {
    fontSize: 24,
    marginLeft: 8,
  },
  
  bellWrapper: { 
    width: 50, 
    alignItems: 'flex-end',
    justifyContent: 'center' 
  },
  webBellWrapper: {
    width: 64,
  },
});