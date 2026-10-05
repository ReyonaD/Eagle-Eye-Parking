import React, { useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { uploadAlertImage } from '../api/alerts';
import { createNote } from '../api/notes';
import LotPickerModal from '../components/LotPickerModal';
import DatePickerModal from '../components/DatePickerModal';
import { Alert } from '../utils/webCompat';

//on native, uri alone is enough for RN's fetch polyfill; on web, expo-image-picker
//also hands back the real browser File, which uploadAlertImage needs (see api/alerts.js)
type PickedPhoto = { uri: string; file?: File };

//"YYYY-MM-DD" (react-native-calendars' dateString) -> "Mon D, YYYY"
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[Number(month) - 1] ?? '';
  return `${m} ${Number(day)}, ${year}`;
};

//Standard US 10-digit phone number, formatted as (XXX) XXX-XXXX while typing.
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isValidPhoneNumber(value: string): boolean {
  return value.replace(/\D/g, '').length === 10;
}

export default function ReportNoteScreen() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [showLotPicker, setShowLotPicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeDateField, setActiveDateField] = useState<'start' | 'end' | null>(null);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo Access Needed', 'Please allow photo library access in Settings to attach a picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera Access Needed', 'Please allow camera access in Settings to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  };

  const handleAddPhotoPress = () => {
    //the web file picker already lets the browser offer camera vs. library, and there's
    //no 3-option web equivalent of Alert.alert to choose between our two native handlers
    if (Platform.OS === 'web') {
      handlePickPhoto();
      return;
    }
    Alert.alert('Add Photo', 'Attach a picture for this note', [
      { text: 'Take Photo', onPress: handleTakePhoto },
      { text: 'Choose from Library', onPress: handlePickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing information', 'Add a subject and a message before submitting.');
      return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
      Alert.alert('Missing information', 'Enter a complete 10-digit phone number so the admin can reach you.');
      return;
    }
    if (!startDate || !endDate) {
      Alert.alert('Missing information', 'Let the admin know how long this will last by picking a start and end date.');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Invalid dates', 'The end date must be on or after the start date.');
      return;
    }

    setSubmitting(true);
    try {
      //dates come from the calendar picker as local midnight; stored as plain
      //calendar days since notes don't need time-of-day precision
      const [sy, sm, sd] = startDate.split('-').map(Number);
      const [ey, em, ed] = endDate.split('-').map(Number);

      const imageUrls: string[] = [];
      if (photo) {
        const { image_url } = await uploadAlertImage(photo);
        imageUrls.push(image_url);
      }

      await createNote({
        title: title.trim(),
        description: message.trim(),
        lot_name: selectedLot || undefined,
        event_start: new Date(sy, sm - 1, sd).toISOString(),
        event_end: new Date(ey, em - 1, ed).toISOString(),
        phone_number: phoneNumber,
        image_urls: imageUrls.length ? imageUrls : undefined,
      });
      Alert.alert('Note sent', 'Your note was sent to the parking team for review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not send your note. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'left']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#00853E" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Note to Admin</Text>
        <TextInput
          style={styles.subjectInput}
          placeholder="SUBJECT"
          placeholderTextColor="#888"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
        />
        <TextInput
          style={styles.messageInput}
          placeholder="WRITE YOUR NOTE"
          placeholderTextColor="#888"
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />
        <TextInput
          style={styles.subjectInput}
          placeholder="PHONE NUMBER"
          placeholderTextColor="#888"
          value={phoneNumber}
          onChangeText={(text) => setPhoneNumber(formatPhoneInput(text))}
          keyboardType="phone-pad"
          maxLength={14}
        />
        <TouchableOpacity style={styles.lotButton} onPress={() => setShowLotPicker(true)}>
          <View style={styles.lotButtonLabel}>
            <Ionicons name="location-outline" size={18} color={selectedLot ? '#00853E' : '#888'} />
            <Text style={[styles.lotButtonText, selectedLot && styles.selectedLotText]}>
              {selectedLot || 'SELECT LOT (OPTIONAL)'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#888" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.lotButton} onPress={() => setActiveDateField('start')}>
          <View style={styles.lotButtonLabel}>
            <Ionicons name="calendar-outline" size={18} color={startDate ? '#00853E' : '#888'} />
            <Text style={[styles.lotButtonText, startDate && styles.selectedLotText]}>
              {startDate ? formatDate(startDate) : 'SELECT START DATE'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#888" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.lotButton} onPress={() => setActiveDateField('end')}>
          <View style={styles.lotButtonLabel}>
            <Ionicons name="calendar-outline" size={18} color={endDate ? '#00853E' : '#888'} />
            <Text style={[styles.lotButtonText, endDate && styles.selectedLotText]}>
              {endDate ? formatDate(endDate) : 'SELECT END DATE'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#888" />
        </TouchableOpacity>

        <Text style={styles.photoLabel}>PHOTO (OPTIONAL)</Text>
        {photo ? (
          <View style={styles.photoThumbWrap}>
            <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
            <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)}>
              <Ionicons name="close" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addPhotoButton} onPress={handleAddPhotoPress}>
            <Ionicons name="camera-outline" size={24} color="#00853E" />
            <Text style={styles.addPhotoText}>ADD PHOTO</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'SENDING...' : 'SUBMIT'}</Text>
        </TouchableOpacity>
      </ScrollView>
      <LotPickerModal
        visible={showLotPicker}
        onClose={() => setShowLotPicker(false)}
        onSelect={(lotName) => setSelectedLot(lotName)}
      />
      <DatePickerModal
        visible={activeDateField !== null}
        onClose={() => setActiveDateField(null)}
        onSelect={(dateString) => {
          if (activeDateField === 'start') setStartDate(dateString);
          if (activeDateField === 'end') setEndDate(dateString);
        }}
        initialDate={(activeDateField === 'start' ? startDate : endDate) || undefined}
        minDate={activeDateField === 'end' ? (startDate || undefined) : undefined}
        title={activeDateField === 'start' ? 'Select start date' : 'Select end date'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backText: {
    color: '#00853E',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#00853E',
    fontSize: 25,
    fontWeight: '800',
    marginBottom: 20,
  },
  subjectInput: {
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    color: '#333',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },
  messageInput: {
    height: 170,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    color: '#333',
    fontSize: 14,
    marginBottom: 14,
  },
  lotButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  lotButtonLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lotButtonText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedLotText: {
    color: '#333',
  },
  photoLabel: { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 10, letterSpacing: 0.5 },
  photoThumbWrap: { width: 80, height: 80, borderRadius: 8, overflow: 'visible', marginBottom: 22 },
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
    marginBottom: 22,
  },
  addPhotoText: { fontSize: 10, fontWeight: '700', color: '#00853E', marginTop: 4 },
  submitButton: {
    minWidth: 130,
    minHeight: 50,
    alignSelf: 'flex-end',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00853E',
    borderRadius: 8,
    paddingHorizontal: 26,
  },
  submitDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});