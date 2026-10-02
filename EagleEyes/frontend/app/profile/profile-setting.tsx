import React, { useState, useEffect, useMemo } from 'react';
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
  Switch,
  Modal,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '../../context/UserContext';
import { useLots } from '../../context/LotsContext';
import { getPermitTypes, updatePermit, updatePlate } from '../../api/auth';
import { Alert } from '../../utils/webCompat';

// Fallback list used only if the live ParkZen fetch fails (e.g. offline),
// so the picker still has something to show.
const FALLBACK_PERMIT_TYPES = [
  'Eagle', 'Remote', 'Faculty and Staff', 'A-Reserved',
  'Resident', 'Resident Reserved', 'Hall Director',
  'Visitor', 'Motorcycle', 'Evening', 'Night',
  'HSG', 'Premium Parking', 'Zip Car',
];

// ParkZen's live /api/permits returns each A-Reserved space's specific permit
// as its raw code ("A01", "A02", ... "A95"), plus the generic, not-tied-to-
// one-lot permit as literal "A-Reserved" (confirmed against a live response —
// ParkZen does NOT resolve these to friendly "Lot NN Reserved" names the way
// it does for some other permit types). Flat and alphabetized, that's ~16
// near-identical "A0N" codes buried among a dozen unrelated permit types — so
// group them under a single "A-Reserved" row instead.
const A_RESERVED_CODE_RE = /^a\s*-?\s*(\d{2,3})$/i;
const A_RESERVED_GENERIC_VALUE = 'a-reserved';
const A_RESERVED_GROUP_LABEL = 'A-Reserved';

type PermitOption =
  | { kind: 'simple'; value: string }
  | { kind: 'group'; label: string; options: { value: string; label: string }[] };

function buildPermitOptions(types: string[]): PermitOption[] {
  const lotEntries: { value: string; label: string; num: number }[] = [];
  const genericEntries: string[] = [];
  const rest: string[] = [];

  types.forEach((raw) => {
    const trimmed = raw.trim();
    const codeMatch = trimmed.match(A_RESERVED_CODE_RE);
    if (codeMatch) {
      const num = parseInt(codeMatch[1], 10);
      lotEntries.push({ value: raw, label: `Lot ${String(num).padStart(2, '0')}`, num });
    } else if (trimmed.toLowerCase() === A_RESERVED_GENERIC_VALUE) {
      genericEntries.push(raw);
    } else {
      rest.push(raw);
    }
  });

  const options: PermitOption[] = rest.map((value) => ({ kind: 'simple', value }));

  if (lotEntries.length || genericEntries.length) {
    lotEntries.sort((a, b) => a.num - b.num);
    options.push({
      kind: 'group',
      label: A_RESERVED_GROUP_LABEL,
      options: [
        ...genericEntries.map((value) => ({ value, label: 'Any A-Reserved lot' })),
        ...lotEntries.map((e) => ({ value: e.value, label: e.label })),
      ],
    });
  }

  return options.sort((a, b) => {
    const labelA = a.kind === 'group' ? a.label : a.value;
    const labelB = b.kind === 'group' ? b.label : b.value;
    return labelA.localeCompare(labelB);
  });
}

// Looks up the friendly label for whatever's currently selected, so the closed
// trigger reads "A-Reserved · Lot 01" instead of the raw code "A01".
function getPermitDisplayLabel(value: string, options: PermitOption[]): string {
  for (const opt of options) {
    if (opt.kind === 'simple' && opt.value === value) return opt.value;
    if (opt.kind === 'group') {
      const sub = opt.options.find((o) => o.value === value);
      if (sub) return `${opt.label} · ${sub.label}`;
    }
  }
  return value;
}

export default function ParkingProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useUser();
  const { filterByPermit, setFilterByPermit } = useLots();
  const { parkingProfile } = user;

  const [plateState, setPlateState] = useState(parkingProfile.plateState);
  const [plateNumber, setPlateNumber] = useState(parkingProfile.plateNumber);
  const [permitType, setPermitType] = useState(parkingProfile.permitType);
  const [permitTypeOpen, setPermitTypeOpen] = useState(false);
  const [aReservedPickerVisible, setAReservedPickerVisible] = useState(false);
  const [permitTypes, setPermitTypes] = useState<string[]>(FALLBACK_PERMIT_TYPES);
  const [permitTypesLoading, setPermitTypesLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const permitOptions = useMemo(() => buildPermitOptions(permitTypes), [permitTypes]);
  const aReservedGroup = permitOptions.find((o) => o.kind === 'group');

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
      const plate = await updatePlate(plateState.trim().toUpperCase(), plateNumber.trim());
      updateUser({
        parkingProfile: {
          plateState: plate.plate_state,
          plateNumber: plate.plate_number,
          permitType,
        },
      });
      router.back();
    } catch (error: any) {
      Alert.alert('Could not save profile', error.message || 'Please try again.');
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
                {permitTypesLoading
                  ? 'Loading permit types…'
                  : (permitType ? getPermitDisplayLabel(permitType, permitOptions) : 'Select permit type')}
              </Text>
              {permitTypesLoading ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <Ionicons name={permitTypeOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#333" />
              )}
            </TouchableOpacity>
            {permitTypeOpen && (
              <View style={styles.dropdownList}>
                {permitOptions.map((opt) => {
                  if (opt.kind === 'simple') {
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setPermitType(opt.value);
                          setPermitTypeOpen(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{opt.value}</Text>
                        {permitType === opt.value && <Ionicons name="checkmark" size={18} color="#00853E" />}
                      </TouchableOpacity>
                    );
                  }

                  const selectedSub = opt.options.find((o) => o.value === permitType);
                  return (
                    <TouchableOpacity
                      key={opt.label}
                      style={styles.dropdownItem}
                      onPress={() => setAReservedPickerVisible(true)}
                    >
                      <Text style={styles.dropdownItemText}>
                        {opt.label}
                        {selectedSub ? ` · ${selectedSub.label}` : ''}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={selectedSub ? '#00853E' : '#999'} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={styles.purchasePermitRow}
              onPress={() => Linking.openURL('https://unt.aimsparking.com/')}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={styles.purchasePermitText}>
                Don&apos;t have a permit?{' '}
                <Text style={styles.purchasePermitLink}>Purchase one</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, styles.visibilityCard]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleTextWrap}>
                <Text style={styles.toggleLabel}>Only show me eligible parking for my permit</Text>
                <Text style={styles.toggleHint}>
                  {permitType
                    ? "Map and Lots will hide lots your permit can't use."
                    : 'Select a permit type above to turn this on.'}
                </Text>
              </View>
              <Switch
                value={filterByPermit}
                onValueChange={setFilterByPermit}
                disabled={!permitType}
                trackColor={{ false: '#ddd', true: '#00853E' }}
                thumbColor="#fff"
              />
            </View>
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

      <Modal
        transparent
        animationType="slide"
        visible={aReservedPickerVisible}
        onRequestClose={() => setAReservedPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setAReservedPickerVisible(false)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Which A-Reserved permit do you have?</Text>
            <Text style={styles.pickerSubtitle}>
              Some A-Reserved permits are only good in one specific lot. Pick your lot below,
              or &quot;Any A-Reserved lot&quot; if yours isn&apos;t tied to just one.
            </Text>
            <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
              {aReservedGroup?.kind === 'group' &&
                aReservedGroup.options.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={styles.pickerOption}
                    onPress={() => {
                      setPermitType(item.value);
                      setAReservedPickerVisible(false);
                      setPermitTypeOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        permitType === item.value && styles.pickerOptionActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {permitType === item.value && <Ionicons name="checkmark" size={20} color="#00853E" />}
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
  visibilityCard: {
    marginTop: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 3,
  },
  toggleHint: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
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
  purchasePermitRow: {
    marginTop: 10,
  },
  purchasePermitText: {
    fontSize: 13,
    color: '#666',
  },
  purchasePermitLink: {
    color: '#00853E',
    fontWeight: '600',
    textDecorationLine: 'underline',
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
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  pickerSubtitle: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 14,
  },
  pickerScroll: {
    maxHeight: 360,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  pickerOptionActive: {
    color: '#00853E',
    fontWeight: '700',
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
