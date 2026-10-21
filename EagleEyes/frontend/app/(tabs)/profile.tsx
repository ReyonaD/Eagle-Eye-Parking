import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isPushEnabled, setPushEnabled, unregisterAlertPush } from '../../utils/pushNotifications';
import { useUser } from '../../context/UserContext';
import { Alert } from '../../utils/webCompat';
import { PINNED_LOTS_STORAGE_KEY } from './lots';
import InitialsAvatar from '../../components/InitialsAvatar';
import { getPermitCardStyle } from '../../utils/permitColors';
import { useLots } from '../../context/LotsContext';
import { lookupPermitHours, summarizePermitHours } from '../../utils/permitHours';
// function TopBar() {
//   const router = useRouter();
//   return (
//     <View style={styles.topBar}>
//       {/* LEFT: Logo + App Name */}
//       <View style={styles.leftGroup}>
//         <Image
//           source={require('../../assets/images/Logo_EagleEye.png')}
//           style={styles.logo}
//         />
//         <Text style={styles.appNameLeft}>EagleEyes</Text>
//       </View>

//       {/* RIGHT: Bell */}
//       <TouchableOpacity style={styles.bellWrapper} onPress={() => router.push('/(tabs)/alerts')}>
//         <Ionicons name="notifications-outline" size={27} color="#333" />
//       </TouchableOpacity>
//     </View>
//   );
// }
// Menu row component
interface MenuRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  showChevron?: boolean;
}

function MenuRow({ icon, label, value, onPress, danger = false, showChevron = true }: MenuRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.5}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>
        <Ionicons name={icon} size={27} color={danger ? '#D0021B' : '#00853E'} />
      </View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {!danger && showChevron && <Ionicons name="chevron-forward" size={27} color="#ccc" />}
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
export function ProfileScreen() {
  const router = useRouter();
  const { user, refreshUser } = useUser();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  useFocusEffect(useCallback(() => { isPushEnabled().then(setNotificationsEnabled); }, []));

  const handleNotificationsToggle = async (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    const nowEnabled = await setPushEnabled(enabled);
    setNotificationsEnabled(nowEnabled);
    if (enabled && !nowEnabled) {
      Alert.alert('Notifications are off', 'Allow notifications for EagleEyes in your device settings, then turn this on again.');
    }
  };

  // Re-sync with the backend whenever this tab is shown, so a profile fetch
  // that failed on app start (offline / cold server) recovers on its own.
  // refreshUser isn't memoized, so listing it would refetch on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => { refreshUser(); }, []));
  const hasPermit = !!user.parkingProfile.permitType;
  const permitCardStyle = getPermitCardStyle(user.parkingProfile.permitType);
  // when this permit may park, from ParkZen ("Any time", "Daily 3:30 PM – 7:00 AM")
  const { permitHours } = useLots();
  const ownPermitHours = lookupPermitHours(permitHours, user.parkingProfile.permitType);

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          //needs the auth token, so it has to run before it's removed
          await unregisterAlertPush();
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

        {/* Header */}
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

        {/* Permit card */}
        {hasPermit ? (
          <TouchableOpacity
            style={[
              styles.permitCard,
              { backgroundColor: permitCardStyle.bg, shadowColor: permitCardStyle.bg },
              permitCardStyle.border ? { borderWidth: 1, borderColor: permitCardStyle.border } : null,
            ]}
            activeOpacity={0.85}
            onPress={() => router.push('/profile/profile-setting' as any)}
          >
            <View style={styles.permitTop}>
              <View style={styles.permitTopLeft}>
                <Text style={[styles.permitLabel, { color: permitCardStyle.label }]}>
                  PARKING PERMIT
                </Text>
                <Text
                  style={[styles.permitType, { color: permitCardStyle.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.55}
                >
                  {user.parkingProfile.permitType}
                </Text>
                {ownPermitHours && (
                  <Text style={[styles.permitHours, { color: permitCardStyle.label }]} numberOfLines={2}>
                    {summarizePermitHours(ownPermitHours)}
                  </Text>
                )}
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
            <View style={styles.permitLots}>
              {user.permit.allowedLots.map((lot) => (
                <View key={lot} style={styles.lotChip}>
                  <Text style={styles.lotChipText}>{lot}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.permitCardEmpty}
            activeOpacity={0.85}
            onPress={() => router.push('/profile/profile-setting' as any)}
          >
            <View style={styles.permitEmptyIconWrap}>
              <Image
                source={require('../../assets/images/updated_logo_Oct.webp')}
                style={styles.permitEmptyLogo}
                resizeMode="contain"
              />
            </View>
            <View style={styles.permitEmptyTextWrap}>
              <Text style={styles.permitEmptyTitle}>Add Your Parking Permit</Text>
              <Text style={styles.permitEmptySubtitle}>See where you&apos;re allowed to park</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}

        {/* Preferences */}
        <Section title="Preferences">
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Ionicons name="notifications-outline" size={27} color="#00853E" />
            </View>
            <Text style={styles.rowLabel}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: '#ddd', true: '#00853E' }}
              thumbColor="#fff"
            />
          </View>
          <Divider />
          <MenuRow
            icon="car-sport-outline"
            label="Profile Setting"
            onPress={() => router.push('/profile/profile-setting' as any)}
          />
          <Divider />
          <MenuRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => router.push('/profile/help-support' as any)}
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

export default ProfileScreen;

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
  avatar: {
    marginBottom: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  namePlaceholder: {
    color: '#aaa',
    fontWeight: '700',
  },
  editIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e8f5ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  email: {
    fontSize: 14,
    color: '#888',
    marginBottom: 14,
  },
  // Permit card
  permitCard: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    position: 'relative',
    overflow: 'hidden',
  },
  permitTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  permitTopLeft: {
    flex: 1,
    marginRight: 10,
  },
  permitHours: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  permitLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  permitType: {
    fontSize: 32,
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
    flexShrink: 0,
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
  permitCardEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#00853E',
    shadowColor: '#00853E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  //new lockup is a wide icon+wordmark image (~2.53:1), not the old square
  //icon-only mark, so this badge is now a pill instead of a circle
  permitEmptyIconWrap: {
    width: 78,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    paddingHorizontal: 6,
  },
  permitEmptyLogo: {
    width: 66,
    height: 26,
  },
  permitEmptyTextWrap: {
    flex: 1,
  },
  permitEmptyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  permitEmptySubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
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
    fontSize: 13,
    fontWeight: '800',
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
    fontSize: 16,
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
