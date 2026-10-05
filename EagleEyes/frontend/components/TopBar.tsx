import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlertsBadge } from '../context/AlertsBadgeContext';
interface TopBarProps {
  role?: 'admin' | 'commuter'; 
}
export default function TopBar({ role = 'commuter' }: TopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unseenCount } = useAlertsBadge();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>
      
      <View style={styles.leftGroup}>
        <Image
          source={require('../assets/images/Logo_EagleEye.png')}
          style={styles.logo}
        />
        <Text style={styles.appNameLeft}>EagleEyes</Text>
      </View>

      {role === 'admin' ? (
        <TouchableOpacity
          style={styles.bellWrapper}
          onPress={() => router.push('/(admin)/commuter-notes')}
          accessibilityLabel="Notes from Commuters"
        >
          <Ionicons name="document-text-outline" size={27} color="#333" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.bellWrapper}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <View>
            <Ionicons name="notifications-outline" size={27} color="#333" />
            {unseenCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unseenCount > 9 ? '9+' : unseenCount}</Text>
              </View>
            )}
          </View>
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

  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#E02D2D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
});