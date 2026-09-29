import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from '../../utils/webCompat';
import { useUser } from '../../context/UserContext';
import { PINNED_LOTS_STORAGE_KEY } from '../(tabs)/lots';
import InitialsAvatar from '../../components/InitialsAvatar';

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  subtitle?: string;
  onPress?: () => void;
}

// Each nav item is its own standalone pill/card (not grouped into a bordered
// white section), matching the admin profile mockup. The leading icon gives
// each row a scannable shape so admins can find the right action at a glance
// instead of reading every label.
function MenuRow({ icon, label, value, subtitle, onPress }: MenuRowProps) {
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.6}
    >
      <View style={styles.menuRowIcon}>
        <Ionicons name={icon} size={20} color="#00853E" />
      </View>
      <View style={styles.menuRowText}>
        <Text style={styles.menuRowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.menuRowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.menuRowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={20} color="#c2c2c2" />
    </TouchableOpacity>
  );
}

export default function AdminProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useUser();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('token');
          await AsyncStorage.removeItem('role');
          await AsyncStorage.removeItem('isOwner');
          //clears the cached profile and pinned lots too, so neither bleeds into the next login
          await AsyncStorage.removeItem(PINNED_LOTS_STORAGE_KEY);
          await refreshUser();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <InitialsAvatar name={user.name} style={styles.avatar} />
          <View style={styles.nameRow}>
            <Text style={[styles.name, !user.name && styles.namePlaceholder]}>
              {user.name || 'Add your name'}
            </Text>
            <TouchableOpacity
              style={styles.editIconBtn}
              onPress={() => router.push('/profile/edit-name' as any)}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Ionicons name="pencil" size={14} color="#00853E" />
            </TouchableOpacity>
          </View>
          <Text style={styles.email}>{user.email}</Text>
        </View>

        <View style={styles.menuList}>
          <Text style={[styles.sectionLabel, styles.sectionLabelFirst]}>QUICK ACTIONS</Text>
          <MenuRow
            icon="warning-outline"
            label="Post New Alert"
            subtitle="Report a new hazard for commuters"
            onPress={() => router.push({ pathname: '/(admin)/post-alert', params: { from: 'profile' } })}
          />
          <MenuRow
            icon="calendar-outline"
            label="Add New Event"
            subtitle="Create a new campus event"
            onPress={() => router.push({ pathname: '/(admin)/events', params: { openAdd: '1' } })}
          />

          <Text style={styles.sectionLabel}>COMMUTER REQUESTS</Text>
          <MenuRow
            icon="document-text-outline"
            label="View Notes from Commuter"
            subtitle="Read notes commuters sent to admins"
            onPress={() => router.push('/(admin)/commuter-notes')}
          />

          <Text style={styles.sectionLabel}>ADMIN ACCESS</Text>
          <MenuRow
            icon="person-add-outline"
            label="Admin Management"
            subtitle="Promote commuters and manage admin access"
            onPress={() => router.push('/(admin)/admin-management')}
          />

          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <View style={styles.menuRow}>
            <View style={styles.menuRowIcon}>
              <Ionicons name="notifications-outline" size={20} color="#00853E" />
            </View>
            <View style={styles.menuRowText}>
              <Text style={styles.menuRowLabel}>Notifications</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#ddd', true: '#00853E' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color="#D0021B" />
          <Text style={styles.logoutBtnText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>EagleEyes v1.0.0 · UNT Capstone Project</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 24,
    paddingBottom: 22,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: {
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  name: { fontSize: 24, fontWeight: '800', color: '#1a1a1a' },
  namePlaceholder: { color: '#aaa', fontWeight: '700' },
  editIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e8f5ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  email: { fontSize: 14, color: '#888', marginBottom: 14 },
  menuList: {
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1.5,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionLabelFirst: {
    marginTop: 0,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 16,
    gap: 8,
  },
  menuRowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#e8f5ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuRowText: {
    flex: 1,
  },
  menuRowLabel: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  menuRowSubtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  menuRowValue: { fontSize: 15, color: '#888' },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fdecea',
    borderRadius: 14,
    marginHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  logoutBtnText: { color: '#D0021B', fontSize: 16, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 12, color: '#bbb', marginVertical: 20 },
});
