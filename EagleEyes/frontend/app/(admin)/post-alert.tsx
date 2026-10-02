import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal, Image, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createAlert, uploadAlertImage } from '../../api/alerts';
import LotPickerModal from '../../components/LotPickerModal';
import { Alert } from '../../utils/webCompat';
import { HAZARD_CATEGORIES as ALERT_TYPES } from '../../utils/alertVisuals';

const MAX_PHOTOS = 3;

//on native, uri alone is enough for RN's fetch polyfill; on web, expo-image-picker
//also hands back the real browser File, which uploadAlertImage needs (see api/alerts.js)
type PickedPhoto = { uri: string; file?: File };

export default function PostAlertScreen() {
  // This screen is a hidden tab route, so router.back() unreliably lands on the
  // tab navigator's default tab (Hazards) instead of wherever it was actually
  // pushed from. Callers pass ?from=... to say where "back" should really go.
  const { from } = useLocalSearchParams<{ from?: string }>();
  const backDestination = from === 'profile' ? '/(admin)/profile' : '/(admin)/hazards';

  const [title, setTitle]               = useState('');
  const [memo, setMemo]                 = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedLot, setSelectedLot]   = useState<string | null>(null);
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
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) addPhoto(result.assets[0]);
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
      Alert.alert('Limit Reached', `You can attach up to ${MAX_PHOTOS} photos per alert.`);
      return;
    }
    //the web file picker already lets the browser offer camera vs. library, and there's
    //no 3-option web equivalent of Alert.alert to choose between our two native handlers
    if (Platform.OS === 'web') {
      handlePickPhoto();
      return;
    }
    Alert.alert('Add Photo', 'Attach a picture to this alert', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

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
      //photos upload one at a time so we can attach the URLs to the alert below
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
      Alert.alert('Posted', 'Hazard alert has been posted.', [
        { text: 'OK', onPress: () => router.replace(backDestination) },
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
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace(backDestination)}>
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

        {/* Photos — optional evidence for the alert */}
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
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddPhotoPress}>
              <Ionicons name="camera-outline" size={24} color="#00853E" />
              <Text style={styles.addPhotoText}>ADD</Text>
            </TouchableOpacity>
          )}
        </View>

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

      <LotPickerModal
        visible={showLotPicker}
        onClose={() => setShowLotPicker(false)}
        onSelect={(lotName) => setSelectedLot(lotName)}
      />

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
