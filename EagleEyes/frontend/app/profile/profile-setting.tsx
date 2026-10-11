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
import { buildPermitOptions, getPermitDisplayLabel, PermitOption, PREMIUM_PARKING } from '../../utils/permits';

// Fallback list used only if the live ParkZen fetch fails (e.g. offline),
// so the picker still has something to show.
const FALLBACK_PERMIT_TYPES = [
  'Eagle', 'Remote', 'Faculty and Staff', 'A-Reserved',
  'Resident', 'Resident Reserved', 'Hall Director',
  'Visitor', 'Motorcycle', 'Evening', 'Night',
  'HSG', PREMIUM_PARKING, 'Zip Car',
];

export default function ParkingProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useUser();
  const { filterByPermit, setFilterByPermit, mapType, setMapType } = useLots();
  const { parkingProfile } = user;

  const [plateState, setPlateState] = useState(parkingProfile.plateState);
  const [plateNumber, setPlateNumber] = useState(parkingProfile.plateNumber);
  const [permitType, setPermitType] = useState(parkingProfile.permitType);
  const [permitTypeOpen, setPermitTypeOpen] = useState(false);
  // Which group's lot picker is open (e.g. "A-Reserved", "Resident Reserved"), or null.
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(null);
  const [permitTypes, setPermitTypes] = useState<string[]>(FALLBACK_PERMIT_TYPES);
  const [permitTypesLoading, setPermitTypesLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const permitOptions = useMemo(() => buildPermitOptions(permitTypes), [permitTypes]);
  const openGroup = permitOptions.find((o): o is Extract<PermitOption, { kind: 'group' }> =>
    o.kind === 'group' && o.label === openGroupLabel
  );

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
              <Text style={[styles.dropdownText, !permitType && styles.dropdownPlaceholder]} numberOfLines={1}>
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
                      onPress={() => setOpenGroupLabel(opt.label)}
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

            {permitType === PREMIUM_PARKING && (
              <View style={styles.premiumParkingNote}>
                <Ionicons name="information-circle-outline" size={16} color="#D6332A" />
                <Text style={styles.premiumParkingNoteText}>
                  Not prepaid — pay via the lot&apos;s QR code, or tap your lot on the Map or
                  Lots tab for a direct{' '}
                  <Text style={styles.purchasePermitLinkStatic}>Premium Parking</Text> link.
                  General lookup:{' '}
                  <Text
                    style={styles.purchasePermitLink}
                    onPress={() => Linking.openURL('https://www.premiumparking.com/')}
                  >
                    premiumparking.com
                  </Text>.
                </Text>
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

          <View style={[styles.card, styles.visibilityCard]}>
            <Text style={styles.toggleLabel}>Map type</Text>
            <Text style={styles.toggleHint}>Choose how the map renders on the Map and Lots tabs.</Text>
            <View style={styles.mapTypeRow}>
              {(['standard', 'satellite'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.mapTypeOption, mapType === type && styles.mapTypeOptionActive]}
                  onPress={() => setMapType(type)}
                >
                  <Ionicons
                    name={type === 'standard' ? 'map-outline' : 'globe-outline'}
                    size={16}
                    color={mapType === type ? '#fff' : '#555'}
                  />
                  <Text style={[styles.mapTypeOptionText, mapType === type && styles.mapTypeOptionTextActive]}>
                    {type === 'standard' ? 'Standard' : 'Satellite'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.card, styles.visibilityCard]}>
            <View style={styles.infoHeaderRow}>
              <Ionicons name="moon" size={16} color="#00853E" />
              <Text style={styles.toggleLabel}>Day / Night permit preview</Text>
            </View>
            <Text style={styles.toggleHint}>
              Permit rules change at night. Tap the map&apos;s settings icon (top-right)
              to preview Day or Night rules before you drive over.
            </Text>
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
        visible={openGroup !== undefined}
        onRequestClose={() => setOpenGroupLabel(null)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setOpenGroupLabel(null)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Which {openGroup?.label} permit do you have?</Text>
            <Text style={styles.pickerSubtitle}>
              Some {openGroup?.label} permits are only good in one specific lot. Pick your lot below,
              or just &quot;{openGroup?.label}&quot; if yours isn&apos;t tied to just one.
            </Text>
            <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
              {openGroup?.options.map((item) => (
                  <TouchableOpacity
                    key={item.value}
                    style={styles.pickerOption}
                    onPress={() => {
                      setPermitType(item.value);
                      setOpenGroupLabel(null);
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
  infoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  toggleHint: {
    fontSize: 12,
    color: '#888',
    lineHeight: 16,
  },
  mapTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  mapTypeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#f9f9f9',
  },
  mapTypeOptionActive: {
    backgroundColor: '#00853E',
    borderColor: '#00853E',
  },
  mapTypeOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  mapTypeOptionTextActive: {
    color: '#fff',
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
    flexShrink: 1,
    marginRight: 6,
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
  // Emphasizes a UI element the note refers to (e.g. a button on another
  // screen) without implying it's tappable right here, unlike the external
  // link style above.
  purchasePermitLinkStatic: {
    fontWeight: '700',
  },
  premiumParkingNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(214, 51, 42, 0.1)',
    borderWidth: 1,
    borderColor: '#D6332A',
  },
  premiumParkingNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#D6332A',
    lineHeight: 17,
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
