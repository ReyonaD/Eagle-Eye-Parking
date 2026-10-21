import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAlertsBadge } from '../context/AlertsBadgeContext';
import { useAdminNotesBadge } from '../context/AdminNotesBadgeContext';
import AdminAccountMenu from './AdminAccountMenu';

const IS_WEB = Platform.OS === 'web';

interface TopBarProps {
  role?: 'admin' | 'commuter';
}
export default function TopBar({ role = 'commuter' }: TopBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unseenCount } = useAlertsBadge();
  //safe to call even on the commuter side, where no provider is mounted -
  //see useAdminNotesBadge's own comment for why
  const { pendingCount } = useAdminNotesBadge();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top }]}>

      <View style={styles.leftGroup}>
        <Image
          source={require('../assets/images/updated_logo_Oct_cropped.webp')}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {role === 'admin' ? (
        <View style={styles.adminRightGroup}>
          {/* on web this now lives in the sidebar instead; mobile keeps this
              icon exactly as before, since mobile nav isn't changing */}
          {!IS_WEB && (
            <TouchableOpacity
              style={styles.bellWrapper}
              onPress={() => router.push('/(admin)/commuter-notes')}
              accessibilityLabel="Notes from Commuters"
            >
              <View>
                <Ionicons name="document-text-outline" size={32} color="#333" />
                {pendingCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          )}
          {/* mobile keeps the Profile tab (with its own Log Out) untouched;
              this account menu is a web-only replacement for that tab */}
          {IS_WEB && <AdminAccountMenu />}
        </View>
      ) : (
        <TouchableOpacity
          style={styles.bellWrapper}
          onPress={() => router.push('/(tabs)/alerts')}
        >
          <View>
            <Ionicons name="notifications-outline" size={32} color="#333" />
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

  //new lockup is a wide icon+wordmark image, unlike the old square icon-only
  //mark, so it carries its own "EagleEyes" name now. This is the version
  //cropped to the artwork (1558x400, ~3.9:1); the uncropped file has ~50%
  //empty padding, which made the visible logo tiny at header size
  logo: {
    width: 196,
    height: 50,
  },

  bellWrapper: {
    width: 50,
    alignItems: 'flex-end',
    justifyContent: 'center'
  },

  adminRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
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
