import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock user data
const MOCK_USER = {
  name: 'Student User',
  email: 'student@unt.edu',
  phone: '(000) 000-0000',
  permit: {
    type: 'E',
    status: 'Active',
    validUntil: 'May 15, 2026',
    allowedLots: [],
  },
  savedLots: [
    { id: '1', name: 'Lot 20', percentOpen: 80 },
    { id: '2', name: 'Lot 14', percentOpen: 62 },
    { id: '3', name: 'Lot 11', percentOpen: 10 },
    { id: '4', name: 'Lot 1',  percentOpen: 3  },
  ],
};

// Menu row component
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
        <Ionicons name={icon} size={20} color={danger ? '#D0021B' : '#00853E'} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {!danger && <Ionicons name="chevron-forward" size={16} color="#ccc" />}
      </View>
    </TouchableOpacity>
  );
}

// Section wrapper
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

// Divider
function Divider() {
  return <View style={styles.divider} />;
}

// Main screen
export default function ProfileScreen() {
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
          router.replace('/login');
        },
      },
    ]);
  };

  // Availability color based on SRS thresholds
  const availabilityColor = (percentOpen: number) => {
    const percentFull = 100 - percentOpen;
    if (percentFull < 85) return '#00853E';
    if (percentFull < 95) return '#F5A623';
    return '#D0021B';
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person-circle" size={88} color="#00853E" />
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push('/profile/details' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={13} color="#fff" />
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Permit card */}
        <View style={styles.permitCard}>
          <View style={styles.permitTop}>
            <View>
              <Text style={styles.permitLabel}>PARKING PERMIT</Text>
              <Text style={styles.permitType}>Type {user.permit.type}</Text>
            </View>
            <View style={[
              styles.permitBadge,
              { backgroundColor: user.permit.status === 'Active' ? '#e8f5ee' : '#fdecea' }
            ]}>
              <View style={[
                styles.permitDot,
                { backgroundColor: user.permit.status === 'Active' ? '#00853E' : '#D0021B' }
              ]} />
              <Text style={[
                styles.permitBadgeText,
                { color: user.permit.status === 'Active' ? '#00853E' : '#D0021B' }
              ]}>
                {user.permit.status}
              </Text>
            </View>
          </View>
          <Text style={styles.permitExpiry}>Valid until {user.permit.validUntil}</Text>
          <View style={styles.permitLots}>
            {user.permit.allowedLots.map((lot) => (
              <View key={lot} style={styles.lotChip}>
                <Text style={styles.lotChipText}>{lot}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Saved lots */}
        <Section title="Saved Lots">
          {user.savedLots.map((lot, index) => (
            <React.Fragment key={lot.id}>
              <TouchableOpacity
                style={styles.row}
                onPress={() => router.push('/profile/parking' as any)}
                activeOpacity={0.5}
              >
                <View style={styles.rowIcon}>
                  <Ionicons name="bookmark" size={20} color="#00853E" />
                </View>
                <Text style={styles.rowLabel}>{lot.name}</Text>
                <View style={styles.rowRight}>
                  <View style={[styles.availDot, { backgroundColor: availabilityColor(lot.percentOpen) }]} />
                  <Text style={[styles.rowValue, { color: availabilityColor(lot.percentOpen) }]}>
                    {lot.percentOpen}% open
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </View>
              </TouchableOpacity>
              {index < user.savedLots.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Section>

        {/* Personal information */}
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

        {/* Parking */}
        <Section title="Parking">
          <MenuRow
            icon="card-outline"
            label="Permit Details"
            value={`Type ${user.permit.type}`}
            onPress={() => router.push('/profile/parking' as any)}
          />
          <Divider />
          <MenuRow
            icon="car-outline"
            label="My Vehicles"
            onPress={() => router.push('/profile/parking' as any)}
          />
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="notifications-outline" size={20} color="#00853E" />
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

        {/* Logout */}
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
  screen: {
    flex: 1,
    backgroundColor: '#f2f2f7',
  },

  // Header
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: 24,
    paddingBottom: 22,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#e8f5ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  name: {
    fontSize: 21,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  email: {
    fontSize: 14,
    color: '#888',
    marginBottom: 14,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00853E',
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 5,
  },
  editBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  // Permit card
  permitCard: {
    backgroundColor: '#00853E',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    shadowColor: '#00853E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  permitTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  permitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  permitType: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
  },
  permitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  permitDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  permitBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  permitExpiry: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 12,
  },
  permitLots: {
    flexDirection: 'row',
    gap: 8,
  },
  lotChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  lotChipText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Section card
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 2,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#e8f5ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rowIconDanger: {
    backgroundColor: '#fdecea',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  rowLabelDanger: {
    color: '#D0021B',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
    color: '#aaa',
  },
  availDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#f2f2f2',
    marginLeft: 62,
  },

  // Footer
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#bbb',
    marginVertical: 20,
  },
});
