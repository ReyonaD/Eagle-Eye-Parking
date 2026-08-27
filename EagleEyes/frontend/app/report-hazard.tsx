import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createAlert } from '../api/alerts';
import LotPickerModal from '../components/LotPickerModal';

const ALERT_TYPES = [
  { label: 'Snow',         value: 'snow' },
  { label: 'Flood',        value: 'flood' },
  { label: 'Traffic Jam',  value: 'traffic jam' },
  { label: 'Tree Branch',  value: 'tree branch' },
  { label: 'Item on Road', value: 'item on road' },
];

export default function ReportHazardScreen() {
  const [title, setTitle]               = useState('');
  const [memo, setMemo]                 = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedLot, setSelectedLot]   = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLotPicker, setShowLotPicker] = useState(false);
  const [isPosting, setIsPosting]       = useState(false);

  const selectedLabel = ALERT_TYPES.find(t => t.value === selectedType)?.label;

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please add a short title for your report.');
      return;
    }
    if (!selectedType) {
      Alert.alert('Missing Type', 'Please select a hazard type.');
      return;
    }
    setIsPosting(true);
    try {
      await createAlert({
        title: title.trim(),
        alert_type: 'hazard',
        category: selectedType,
        description: memo.trim() || undefined,
        lot_name: selectedLot || undefined,
      });
      //commuter reports go to the admin review queue, not straight to the feed
      Alert.alert(
        'Report Submitted',
        'Thanks! Your report was sent to the parking team for review and will appear once approved.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch {
      Alert.alert('Error', 'Could not submit your report. Make sure you are logged in and try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'right', 'left']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#00853E" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.screenTitle}>Report a Hazard</Text>
        <Text style={styles.screenSubtitle}>
          Spotted something in a parking lot? Let the parking team know.
        </Text>

        <TextInput
          style={styles.titleInput}
          placeholder="ADD THE ALERT TITLE"
          placeholderTextColor="#aaa"
          value={title}
          onChangeText={setTitle}
          autoCapitalize="characters"
        />

        <TextInput
          style={styles.memoInput}
          placeholder="ADD MEMO/DESCRIPTION (LOT, LOCATION, DETAILS)"
          placeholderTextColor="#aaa"
          value={memo}
          onChangeText={setMemo}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={styles.typeSelector}
          onPress={() => setShowDropdown(true)}
        >
          <Text style={[styles.typeSelectorText, !!selectedType && styles.typeSelectorSelected]}>
            {selectedLabel ?? 'SELECT HAZARD TYPE'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#aaa" />
        </TouchableOpacity>

        {/* Lot selector — opens the map + nearest-lot list picker */}
        <TouchableOpacity
          style={styles.lotSelector}
          onPress={() => setShowLotPicker(true)}
        >
          <View style={styles.lotSelectorLeft}>
            <Ionicons name="location-outline" size={18} color={selectedLot ? '#00853E' : '#aaa'} />
            <Text style={[styles.typeSelectorText, !!selectedLot && styles.typeSelectorSelected]}>
              {selectedLot ?? 'SELECT LOT (OPTIONAL)'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#aaa" />
        </TouchableOpacity>

        <View style={styles.postRow}>
          <TouchableOpacity
            style={[styles.postButton, isPosting && styles.postButtonDisabled]}
            onPress={handleSubmit}
            disabled={isPosting}
          >
            {isPosting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>SUBMIT</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <LotPickerModal
        visible={showLotPicker}
        onClose={() => setShowLotPicker(false)}
        onSelect={(lotName) => setSelectedLot(lotName)}
      />

      <Modal visible={showDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDropdown(false)}
        >
          <View style={styles.dropdownBox}>
            {ALERT_TYPES.map(type => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.dropdownItem,
                  selectedType === type.value && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setSelectedType(type.value);
                  setShowDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    selectedType === type.value && styles.dropdownItemTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scroll: { padding: 20, paddingBottom: 40 },

  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { color: '#00853E', fontSize: 16, fontWeight: '600' },

  screenTitle: { fontSize: 26, fontWeight: '800', color: '#00853E', marginBottom: 4 },
  screenSubtitle: { fontSize: 14, color: '#666', marginBottom: 24 },

  titleInput: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  memoInput: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    color: '#333',
    height: 140,
    marginBottom: 16,
  },
  typeSelector: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  typeSelectorText: { fontSize: 14, fontWeight: '700', color: '#aaa' },
  typeSelectorSelected: { color: '#333' },
  lotSelector: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -24,
    marginBottom: 40,
  },
  lotSelectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  postRow: { alignItems: 'flex-end' },
  postButton: {
    backgroundColor: '#00853E',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
    minWidth: 120,
    alignItems: 'center',
  },
  postButtonDisabled: { opacity: 0.6 },
  postButtonText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  dropdownBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownItemActive: { backgroundColor: '#E8F5EE' },
  dropdownItemText: { fontSize: 15, fontWeight: '600', color: '#333' },
  dropdownItemTextActive: { color: '#00853E' },
});
