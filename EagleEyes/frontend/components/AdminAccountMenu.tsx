import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { clearSession } from '../utils/session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../context/UserContext';
import { Alert } from '../utils/webCompat';
import InitialsAvatar from './InitialsAvatar';

const IS_WEB = Platform.OS === 'web';

// Admin account menu in the TopBar (Profile Details / Log Out); name hidden on narrow screens.
export default function AdminAccountMenu() {
  const { user, refreshUser } = useUser();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    setOpen(false);
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          //clears the token, role, push registration and pinned lots, then the
          //cached profile, so nothing bleeds into the next login
          await clearSession();
          await refreshUser();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <InitialsAvatar name={user.name} size={32} />
        {IS_WEB && (
          <>
            <Text style={styles.name} numberOfLines={1}>{user.name || 'Admin'}</Text>
            <Ionicons name="chevron-down" size={14} color="#666" />
          </>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          {/* anchored just under the TopBar */}
          <View style={[styles.dropdown, { top: insets.top + 78 }]}>
            <View style={styles.dropdownHeader}>
              <Text style={styles.dropdownName} numberOfLines={1}>{user.name || 'Admin'}</Text>
              <Text style={styles.dropdownEmail} numberOfLines={1}>{user.email}</Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.item}
              onPress={() => { setOpen(false); router.push('/(admin)/profile'); }}
            >
              <Ionicons name="person-outline" size={18} color="#333" />
              <Text style={styles.itemText}>Profile Details</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.item} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={18} color="#D0021B" />
              <Text style={[styles.itemText, styles.logoutText]}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: { fontSize: 14, fontWeight: '700', color: '#333', maxWidth: 140 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  dropdown: {
    position: 'absolute',
    right: 12,
    width: 220,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  dropdownHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  dropdownName: { fontSize: 14, fontWeight: '800', color: '#1a1a1a' },
  dropdownEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  itemText: { fontSize: 14, fontWeight: '600', color: '#333' },
  logoutText: { color: '#D0021B' },
  divider: { height: 1, backgroundColor: '#eee' },
});
