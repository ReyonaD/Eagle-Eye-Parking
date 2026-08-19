import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createAlert } from '../../api/alerts';

const ALERT_TYPES = [
  { label: 'Snow',         value: 'snow' },
  { label: 'Flood',        value: 'flood' },
  { label: 'Traffic Jam',  value: 'traffic jam' },
  { label: 'Tree Branch',  value: 'tree branch' },
  { label: 'Item on Road', value: 'item on road' },
];

export default function PostAlertScreen() {
  const [title, setTitle]               = useState('');
  const [memo, setMemo]                 = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPosting, setIsPosting]       = useState(false);

  const selectedLabel = ALERT_TYPES.find(t => t.value === selectedType)?.label;

  const handlePost = async () => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please add an alert title.');
      return;
    }
    if (!selectedType) {
      Alert.alert('Missing Type', 'Please select an alert type.');
      return;
    }
    setIsPosting(true);
    try {
      await createAlert({
        title: title.trim(),
        alert_type: 'hazard',
        category: selectedType,
        description: memo.trim() || undefined,
      });
      Alert.alert('Posted', 'Hazard alert has been posted.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not post the alert. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#00853E" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        {/* Alert title */}
        <TextInput
          style={styles.titleInput}
          placeholder="ADD THE ALERT TITLE"
          placeholderTextColor="#aaa"
          value={title}
          onChangeText={setTitle}
          autoCapitalize="characters"
        />

        {/* Memo / description */}
        <TextInput
          style={styles.memoInput}
          placeholder="ADD MEMO/DESCRIPTION"
          placeholderTextColor="#aaa"
          value={memo}
          onChangeText={setMemo}
          multiline
          textAlignVertical="top"
        />

        {/* Alert type selector */}
        <TouchableOpacity
          style={styles.typeSelector}
          onPress={() => setShowDropdown(true)}
        >
          <Text style={[styles.typeSelectorText, !!selectedType && styles.typeSelectorSelected]}>
            {selectedLabel ?? 'SELECT ALERT TYPE'}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#aaa" />
        </TouchableOpacity>

        {/* POST button — aligned right, matching mockup */}
        <View style={styles.postRow}>
          <TouchableOpacity
            style={[styles.postButton, isPosting && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={isPosting}
          >
            {isPosting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>POST</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Dropdown modal */}
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

  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  backText: { color: '#00853E', fontSize: 16, fontWeight: '600' },

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

  // Dropdown
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
    borderBottomColor: '#f0f0f0',
  },
  dropdownItemActive: { backgroundColor: '#e8f5ee' },
  dropdownItemText: { fontSize: 15, color: '#333' },
  dropdownItemTextActive: { color: '#00853E', fontWeight: '700' },
});
