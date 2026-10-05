import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { promoteToAdmin, getAdmins, grantOwner, revokeAdmin } from '../../api/auth';
import { useUser } from '../../context/UserContext';
import { Alert } from '../../utils/webCompat';

const IS_WEB = Platform.OS === 'web';

interface AdminRow {
  id: number;
  email: string;
  name: string | null;
  is_owner: boolean;
}

export default function AdminManagementScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const [isOwner, setIsOwner] = useState(false);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [actioningEmail, setActioningEmail] = useState<string | null>(null);

  const loadAdmins = async () => {
    try {
      const list = await getAdmins();
      setAdmins(list);
    } catch {
      // Not an owner, or the request failed — the section just stays hidden/empty.
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('isOwner').then(async (value) => {
      const owner = value === 'true';
      setIsOwner(owner);
      if (owner) await loadAdmins();
      setAdminsLoading(false);
    });
  }, []);

  const handlePromote = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      Alert.alert('Email required', "Enter the commuter's account email.");
      return;
    }
    setSaving(true);
    try {
      await promoteToAdmin(trimmed);
      setEmail('');
      //stay on this screen instead of bouncing back to Profile, so an owner
      //can see the new admin land in the roster right away
      if (isOwner) await loadAdmins();
      Alert.alert('Success', `${trimmed} is now an admin.`);
    } catch (error: any) {
      Alert.alert('Could not promote user', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGrantOwner = (admin: AdminRow) => {
    Alert.alert(
      'Make Owner',
      `Give ${admin.name || admin.email} owner access? Owners can manage every other admin's access, including yours.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Make Owner',
          onPress: async () => {
            setActioningEmail(admin.email);
            try {
              await grantOwner(admin.email);
              await loadAdmins();
            } catch (error: any) {
              Alert.alert('Could not grant owner access', error.message || 'Please try again.');
            } finally {
              setActioningEmail(null);
            }
          },
        },
      ]
    );
  };

  const handleRevoke = (admin: AdminRow) => {
    Alert.alert(
      'Revoke Access',
      `Remove admin access from ${admin.name || admin.email}? They'll go back to a regular commuter account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setActioningEmail(admin.email);
            try {
              await revokeAdmin(admin.email);
              await loadAdmins();
            } catch (error: any) {
              Alert.alert('Could not revoke access', error.message || 'Please try again.');
            } finally {
              setActioningEmail(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* web is reached from the account menu / sidebar, not a navigation
            stack, so a page title replaces the mobile-style back header */}
        {IS_WEB ? (
          <View style={styles.webHeader}>
            <Text style={styles.screenTitle}>Admin Management</Text>
          </View>
        ) : (
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/(admin)/profile')} hitSlop={10}>
              <Ionicons name="chevron-back" size={27} color="#00853E" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Admin Management</Text>
            <View style={{ width: 27 }} />
          </View>
        )}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.subtitle}>Promote commuters and manage who has admin access</Text>

          <Text style={styles.sectionLabel}>PROMOTE A COMMUTER</Text>
          <View style={styles.card}>
            <Text style={styles.helperText}>
              Enter the email of an existing commuter account to give it admin access.
            </Text>
            <Text style={styles.label}>Commuter Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="student@unt.edu"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, saving && styles.btnDisabled]}
              onPress={handlePromote}
              activeOpacity={0.7}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>PROMOTE</Text>
              )}
            </TouchableOpacity>
          </View>

          {isOwner && (
            <>
              <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>CURRENT ADMINS</Text>
              {adminsLoading ? (
                <ActivityIndicator size="small" color="#00853E" style={{ marginTop: 12 }} />
              ) : admins.length === 0 ? (
                <Text style={styles.emptyText}>No admins found.</Text>
              ) : (
                admins.map((admin) => {
                  const isSelf = admin.email === user.email;
                  const isActioning = actioningEmail === admin.email;
                  return (
                    <View key={admin.id} style={styles.adminCard}>
                      <View style={styles.adminTopRow}>
                        <View style={styles.adminInfo}>
                          <Text style={styles.adminName} numberOfLines={1}>
                            {admin.name || admin.email}{isSelf ? ' (You)' : ''}
                          </Text>
                          <Text style={styles.adminEmail} numberOfLines={1}>{admin.email}</Text>
                        </View>
                        {admin.is_owner && (
                          <View style={styles.ownerBadge}>
                            <Ionicons name="shield-checkmark" size={12} color="#00853E" />
                            <Text style={styles.ownerBadgeText}>OWNER</Text>
                          </View>
                        )}
                      </View>

                      {!isSelf && (
                        <View style={styles.adminActions}>
                          {!admin.is_owner && (
                            <TouchableOpacity
                              style={[styles.actionBtn, styles.makeOwnerBtn]}
                              onPress={() => handleGrantOwner(admin)}
                              disabled={isActioning}
                              activeOpacity={0.7}
                            >
                              {isActioning ? (
                                <ActivityIndicator size="small" color="#00853E" />
                              ) : (
                                <>
                                  <Ionicons name="shield-checkmark-outline" size={16} color="#00853E" />
                                  <Text style={styles.makeOwnerBtnText}>Make Owner</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.revokeBtn]}
                            onPress={() => handleRevoke(admin)}
                            disabled={isActioning}
                            activeOpacity={0.7}
                          >
                            {isActioning ? (
                              <ActivityIndicator size="small" color="#D0021B" />
                            ) : (
                              <>
                                <Ionicons name="close-circle-outline" size={16} color="#D0021B" />
                                <Text style={styles.revokeBtnText}>Revoke Access</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  webHeader: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#00853E',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionLabelSpaced: {
    marginTop: 28,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  helperText: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  input: {
    height: 46,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1a1a1a',
  },
  primaryBtn: {
    backgroundColor: '#00853E',
    paddingVertical: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 8,
  },
  adminCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  adminTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  adminInfo: {
    flex: 1,
  },
  adminName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  adminEmail: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5ee',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00853E',
  },
  adminActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  makeOwnerBtn: {
    backgroundColor: '#e8f5ee',
    borderColor: '#c5e6d3',
  },
  makeOwnerBtnText: {
    color: '#00853E',
    fontSize: 14,
    fontWeight: '700',
  },
  revokeBtn: {
    backgroundColor: '#fdecea',
    borderColor: '#f6c9c3',
  },
  revokeBtnText: {
    color: '#D0021B',
    fontSize: 14,
    fontWeight: '700',
  },
});
