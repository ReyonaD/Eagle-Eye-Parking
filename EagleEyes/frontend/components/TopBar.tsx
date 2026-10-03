import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// TEMPORARY mock unread count for the admin Notes-from-Commuters badge, isolated
// here on its own so it's a one-line swap once Monica's real unread-count API
// exists — no new state/context introduced for it in the meantime.
const MOCK_UNREAD_NOTE_COUNT = 2;

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

      {role === 'admin' ? (
        <TouchableOpacity
          style={styles.bellWrapper}
          onPress={() => router.push('/(admin)/commuter-notes')}
          accessibilityLabel="Notes from Commuters"
        >
          <View>
            <Ionicons name="document-text-outline" size={27} color="#333" />
            {MOCK_UNREAD_NOTE_COUNT > 0 && (
              <View style={styles.noteBadge}>
                <Text style={styles.noteBadgeText}>{MOCK_UNREAD_NOTE_COUNT}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.bellWrapper}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <Ionicons name="notifications-outline" size={27} color="#333" />
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
  noteBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E74C3C',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  noteBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});