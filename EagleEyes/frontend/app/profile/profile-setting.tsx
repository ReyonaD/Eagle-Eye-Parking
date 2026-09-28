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
import { useUser } from '../../context/UserContext';
import { getPermitTypes, updatePermit } from '../../api/auth';
import { Alert } from '../../utils/webCompat';

// Fallback list used only if the live ParkZen fetch fails (e.g. offline),
// so the picker still has something to show.
const FALLBACK_PERMIT_TYPES = [
  'Eagle', 'Remote', 'Faculty and Staff', 'A-Reserved',
  'Resident', 'Resident Reserved', 'Hall Director',
  'Visitor', 'Motorcycle', 'Evening', 'Night',
  'HSG', 'Premium Parking', 'Zip Car',
];

export default function ParkingProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useUser();
  const { parkingProfile } = user;

  const [plateState, setPlateState] = useState(parkingProfile.plateState);
  const [plateNumber, setPlateNumber] = useState(parkingProfile.plateNumber);
  const [permitType, setPermitType] = useState(parkingProfile.permitType);
  const [permitTypeOpen, setPermitTypeOpen] = useState(false);
  const [permitTypes, setPermitTypes] = useState<string[]>(FALLBACK_PERMIT_TYPES);
  const [permitTypesLoading, setPermitTypesLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPermitTypes()
      .then((types: string[]) => {
        if (Array.isArray(types) && types.length > 0) setPermitTypes(types);
      })
      .catch(() => {
        // Keep the fallback list — the picker still works, just not live.
      })
      .finally(() => setPermitTypesLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (permitType) {
        await updatePermit(permitType);
      }
      updateUser({
        parkingProfile: {
          plateState: plateState.trim().toUpperCase(),
          plateNumber: plateNumber.trim(),
          permitType,
        },
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Could not save permit', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'left']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={27} color="#00853E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile Setting</Text>
          <View style={{ width: 27 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.helperText}>
            Fields marked with an asterisk (*) are required to start or find a parking session.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Vehicle License Plate Number *</Text>
            <View style={styles.plateRow}>
              <TextInput
                style={[styles.input, styles.plateStateInput]}
                value={plateState}
                onChangeText={setPlateState}
                placeholder="TX"
                autoCapitalize="characters"
                maxLength={2}
              />
              <TextInput
                style={[styles.input, styles.plateNumberInput]}
                value={plateNumber}
                onChangeText={setPlateNumber}
                placeholder="00000"
                autoCapitalize="characters"
              />
            </View>

            <Text style={styles.label}>Parking Permit</Text>
            <TouchableOpacity
              style={styles.dropdownBox}
              onPress={() => setPermitTypeOpen(!permitTypeOpen)}
              activeOpacity={0.7}
              disabled={permitTypesLoading}
            >
              <Text style={[styles.dropdownText, !permitType && styles.dropdownPlaceholder]}>
                {permitTypesLoading ? 'Loading permit types…' : (permitType || 'Select permit type')}
              </Text>
              {permitTypesLoading ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <Ionicons name={permitTypeOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#333" />
              )}
            </TouchableOpacity>
            {permitTypeOpen && (
              <View style={styles.dropdownList}>
                {permitTypes.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setPermitType(item);
                      setPermitTypeOpen(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{item}</Text>
                    {permitType === item && <Ionicons name="checkmark" size={18} color="#00853E" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.7}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f2f2f7',
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
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  helperText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 12,
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    height: 46,
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1a1a1a',
  },
  plateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  plateStateInput: {
    width: 72,
    textAlign: 'center',
  },
  plateNumberInput: {
    flex: 1,
  },
  dropdownBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 46,
    backgroundColor: '#f2f2f7',
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  dropdownText: {
    fontSize: 15,
    color: '#1a1a1a',
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  dropdownList: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#f2f2f7',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  saveBtn: {
    backgroundColor: '#00853E',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
