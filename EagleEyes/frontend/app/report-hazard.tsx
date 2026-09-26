import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createAlert, uploadAlertImage } from '../api/alerts';
import LotPickerModal from '../components/LotPickerModal';
import { Alert } from '../utils/webCompat';

const ALERT_TYPES = [
  { label: 'Snow',         value: 'snow' },
  { label: 'Flood',        value: 'flood' },
  { label: 'Traffic Jam',  value: 'traffic jam' },
  { label: 'Tree Branch',  value: 'tree branch' },
  { label: 'Item on Road', value: 'item on road' },
];

const MAX_PHOTOS = 3;

//on native, uri alone is enough for RN's fetch polyfill; on web, expo-image-picker
//also hands back the real browser File, which uploadAlertImage needs (see api/alerts.js)
type PickedPhoto = { uri: string; file?: File };

export default function ReportHazardScreen() {
  const [title, setTitle]               = useState('');
  const [memo, setMemo]                 = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedLot, setSelectedLot]   = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showLotPicker, setShowLotPicker] = useState(false);
  const [photos, setPhotos]             = useState<PickedPhoto[]>([]);
  const [isPosting, setIsPosting]       = useState(false);

  const selectedLabel = ALERT_TYPES.find(t => t.value === selectedType)?.label;

  const addPhoto = (photo: PickedPhoto) => setPhotos(prev => [...prev, photo]);
  const removePhoto = (uri: string) => setPhotos(prev => prev.filter(p => p.uri !== uri));

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Access Needed', 'Please allow camera access in Settings to take a photo.');
      return;
    }
    //the camera captures one photo per session, so chain sessions until the
    //user is done or the photo limit is reached
    let count = photos.length;
    while (count < MAX_PHOTOS) {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (result.canceled || !result.assets?.[0]) break;
      addPhoto(result.assets[0]);
      count += 1;
      if (count >= MAX_PHOTOS) break;
      const takeAnother = await new Promise<boolean>(resolve => {
        Alert.alert('Photo Added', `${count}/${MAX_PHOTOS} photos attached. Take another?`, [
          { text: 'Done', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Take Another', onPress: () => resolve(true) },
        ]);
      });
      if (!takeAnother) break;
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo Access Needed', 'Please allow photo library access in Settings to attach a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: MAX_PHOTOS - photos.length,
    });
    if (!result.canceled) {
      result.assets.slice(0, MAX_PHOTOS - photos.length).forEach(a => addPhoto(a));
    }
  };

  const handleAddPhotoPress = () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Limit Reached', `You can attach up to ${MAX_PHOTOS} photos per report.`);
      return;
    }
    //the web file picker already lets the browser offer camera vs. library, and there's
    //no 3-option web equivalent of Alert.alert to choose between our two native handlers
    if (Platform.OS === 'web') {
      handlePickPhoto();
      return;
    }
    Alert.alert('Add Photo', 'Attach a picture of the hazard', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
      //photos upload one at a time so we can attach the URLs to the report below
      const imageUrls: string[] = [];
      for (const photo of photos) {
        const { image_url } = await uploadAlertImage(photo);
        imageUrls.push(image_url);
      }

      await createAlert({
        title: title.trim(),
        alert_type: 'hazard',
        category: selectedType,
        description: memo.trim() || undefined,
        lot_name: selectedLot || undefined,
        image_urls: imageUrls.length ? imageUrls : undefined,
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

        {/* Photos — optional evidence for the report */}
        <Text style={styles.photosLabel}>PHOTOS (OPTIONAL)</Text>
        <View style={styles.photosRow}>
          {photos.map(photo => (
            <View key={photo.uri} style={styles.photoThumbWrap}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
              <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(photo.uri)}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          ))}
          {Array.from({ length: MAX_PHOTOS - photos.length }).map((_, i) => (
            <TouchableOpacity key={`add-slot-${i}`} style={styles.addPhotoButton} onPress={handleAddPhotoPress}>
              <Ionicons name="camera-outline" size={24} color="#00853E" />
              <Text style={styles.addPhotoText}>ADD</Text>
            </TouchableOpacity>
          ))}
        </View>

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

  photosLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 10, letterSpacing: 0.5 },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  photoThumbWrap: { width: 80, height: 80, borderRadius: 8, overflow: 'visible' },
  photoThumb: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#e0e0e0' },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#E74C3C',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#00853E',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoText: { fontSize: 11, fontWeight: '800', color: '#00853E' },

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
