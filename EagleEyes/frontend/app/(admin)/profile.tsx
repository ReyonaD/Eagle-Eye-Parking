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

const MOCK_USER = {
  name: 'Admin User',
  email: 'admin@unt.edu',
  phone: '(000) 000-0000',
};

interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuRow({ icon, label, value, onPress, danger = false }: MenuRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.5}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={27} color={danger ? '#D0021B' : '#00853E'} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {!danger && <Ionicons name="chevron-forward" size={27} color="#ccc" />}
      </View>
    </TouchableOpacity>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

export default function AdminProfileScreen() {
  const router = useRouter();
  const [user] = useState(MOCK_USER);
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
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-circle" size={27} color="#00853E" />
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/profile/details' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={27} color="#fff" />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        <Section title="Personal Information">
          <MenuRow
            icon="person-outline"
            label="Full Name"
            value={user.name}
            onPress={() => router.push('/profile/details' as any)}
          />
          <Divider />
          <MenuRow
            icon="mail-outline"
            label="Email"
            value={user.email}
            onPress={() => router.push('/profile/details' as any)}
          />
          <Divider />
          <MenuRow
            icon="call-outline"
            label="Phone"
            value={user.phone}
            onPress={() => router.push('/profile/details' as any)}
          />
        </Section>

        <Section title="Preferences">
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="notifications-outline" size={27} color="#00853E" />
            </View>
            <Text style={styles.rowLabel}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#ddd', true: '#00853E' }}
              thumbColor="#fff"
            />
          </View>
          <Divider />
          <MenuRow
            icon="settings-outline"
            label="App Settings"
            onPress={() => router.push('/profile/settings' as any)}
          />
          <Divider />
          <MenuRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => router.push('/profile/settings' as any)}
          />
        </Section>

        <Section title="">
          <MenuRow
            icon="log-out-outline"
            label="Log Out"
            onPress={handleLogout}
            danger
          />
        </Section>

        <Text style={styles.version}>EagleEyes v1.0.0 · UNT Capstone Project</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f2f2f7' },
  header: {
    alignItems: 'center', backgroundColor: '#fff', paddingTop: 24, paddingBottom: 22,
    marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#e8f5ee',
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  name: { fontSize: 21, fontWeight: '700', color: '#1a1a1a', marginBottom: 3 },
  email: { fontSize: 14, color: '#888', marginBottom: 14 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#00853E',
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, gap: 5,
  },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 16, marginBottom: 16,
    paddingVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  rowIcon: {
    width: 34, height: 34, borderRadius: 8, backgroundColor: '#e8f5ee', justifyContent: 'center',
    alignItems: 'center', marginRight: 12,
  },
  rowIconDanger: { backgroundColor: '#fdecea' },
  rowLabel: { flex: 1, fontSize: 15, color: '#1a1a1a', fontWeight: '500' },
  rowLabelDanger: { color: '#D0021B' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 13, color: '#aaa' },
  divider: { height: 1, backgroundColor: '#f2f2f2', marginLeft: 62 },
  version: { textAlign: 'center', fontSize: 12, color: '#bbb', marginVertical: 20 },
});