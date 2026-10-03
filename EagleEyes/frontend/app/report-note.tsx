import React, { useState } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import LotPickerModal from '../components/LotPickerModal';
import EndTimePicker, {
  DEFAULT_END_TIME,
  EndTimeValue,
  Period,
  formatStartDateTimeInput,
  isValidStartDateTime,
  isEndTimeValid,
} from '../components/EndTimePicker';
import { useUser } from '../context/UserContext';
import { Alert } from '../utils/webCompat';

// Note to Admin's backend is owned by Monica and not connected yet (see
// api/notes.js). This screen is built end-to-end through the Review step;
// the final Submit button is intentionally disabled until that API exists.

type PickedPhoto = { uri: string; file?: File };

// Standard US 10-digit phone number, formatted as (XXX) XXX-XXXX while typing.
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
  const { user } = useUser();
  const [step, setStep] = useState<'form' | 'review'>('form');

  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [showLotPicker, setShowLotPicker] = useState(false);
  const [startDateTime, setStartDateTime] = useState('');
  const [startPeriod, setStartPeriod] = useState<Period>('AM');
  const [endTime, setEndTime] = useState<EndTimeValue>(DEFAULT_END_TIME);
  const [plateState, setPlateState] = useState(user.parkingProfile.plateState);
  const [plateNumber, setPlateNumber] = useState(user.parkingProfile.plateNumber);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);

  const handleAddPhotoPress = async () => {
    if (Platform.OS === 'web') {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
      return;
    }
    Alert.alert('Add Photo', 'Attach a picture for this note', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Camera Access Needed', 'Please allow camera access in Settings to take a photo.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Photo Access Needed', 'Please allow photo library access in Settings to attach a picture.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
          if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleContinue = () => {
    if (
      !reason.trim() ||
      !selectedLot ||
      !plateState.trim() ||
      !plateNumber.trim() ||
      !phoneNumber.trim()
    ) {
      Alert.alert(
        'Missing information',
        'Reason, Lot/Location, Start time, License Plate, and Phone Number are required before continuing.'
      );
      return;
    }
    if (!isValidStartDateTime(startDateTime)) {
      Alert.alert('Invalid start time', 'Enter a start date as MM/DD and a start time as H:MM (e.g. 9:32).');
      return;
    }
    if (!isEndTimeValid(endTime)) {
      Alert.alert('Invalid end time', 'Enter a custom end date as MM/DD and a custom end time as H:MM (e.g. 5:00).');
      return;
    }
    if (!isValidPhoneNumber(phoneNumber)) {
      Alert.alert('Invalid phone number', 'Enter a complete 10-digit phone number.');
      return;
    }
    setStep('review');
  };

  const handleBack = () => {
    if (step === 'review') {
      setStep('form');
      return;
    }
    router.back();
  };

  const endTimeSummary = (() => {
    switch (endTime.mode) {
      case '24hr': return '24 hour';
      case 'endOfDay': return 'End of day';
      case 'overnight': return 'Overnight';
      case 'custom': return `${endTime.customDate || 'MM/DD'} ${endTime.customTime || '--:--'} ${endTime.customPeriod}`;
    }
  })();

  if (step === 'review') {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'right', 'left']}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="chevron-back" size={20} color="#00853E" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Note to Admin Confirmation</Text>

          <View style={styles.reviewCard}>
            <Text style={styles.reviewLabel}>Reason: <Text style={styles.reviewValue}>{reason}</Text></Text>
            {!!detail.trim() && (
              <>
                <Text style={[styles.reviewLabel, styles.reviewLabelSpaced]}>Detail:</Text>
                <Text style={styles.reviewValue}>{detail}</Text>
              </>
            )}
            <Text style={[styles.reviewLabel, styles.reviewLabelSpaced]}>
              Lot/Location: <Text style={styles.reviewValue}>{selectedLot}</Text>
            </Text>
            <Text style={styles.reviewLabel}>
              Start time: <Text style={styles.reviewValue}>{startDateTime} {startPeriod}</Text>
            </Text>
            <Text style={styles.reviewLabel}>
              End time: <Text style={styles.reviewValue}>{endTimeSummary}</Text>
            </Text>
            <Text style={styles.reviewLabel}>
              License Plate: <Text style={styles.reviewValue}>{plateState} {plateNumber}</Text>
            </Text>
            <Text style={styles.reviewLabel}>
              Phone Number: <Text style={styles.reviewValue}>{phoneNumber}</Text>
            </Text>

            {photo && (
              <View style={styles.photoRow}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
              </View>
            )}

            {/* Pending Monica's Note to Admin API contract — see api/notes.js.
                Intentionally disabled rather than calling a fake/incomplete endpoint. */}
            <TouchableOpacity style={[styles.submitButton, styles.submitButtonDisabled]} disabled>
              <Text style={styles.submitButtonText}>SUBMIT (Backend Not Connected Yet)</Text>
            </TouchableOpacity>
            <Text style={styles.pendingHint}>
              This note is not sent anywhere yet — submission will be enabled once the Note to Admin API is ready.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'left']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="chevron-back" size={20} color="#00853E" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Note to Admin</Text>

        <TouchableOpacity style={styles.lotButton} onPress={() => setShowLotPicker(true)}>
          <View style={styles.lotButtonLabel}>
            <Ionicons name="location-outline" size={18} color={selectedLot ? '#00853E' : '#888'} />
            <Text style={[styles.lotButtonText, selectedLot && styles.selectedLotText]}>
              {selectedLot || 'LOT / LOCATION *'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#888" />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="REASON *"
          placeholderTextColor="#888"
          value={reason}
          onChangeText={setReason}
          maxLength={100}
        />
        <TextInput
          style={styles.messageInput}
          placeholder="DETAIL (OPTIONAL)"
          placeholderTextColor="#888"
          value={detail}
          onChangeText={setDetail}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />

        <Text style={styles.sectionLabel}>START TIME *</Text>
        <View style={styles.startTimeContainer}>
          <TextInput
            style={styles.startTimeInput}
            placeholder="MM/DD  --:--"
            placeholderTextColor="#888"
            value={startDateTime}
            onChangeText={(text) => setStartDateTime(formatStartDateTimeInput(text))}
            keyboardType="number-pad"
            maxLength={11}
          />
          <TouchableOpacity
            style={[styles.startPeriodButton, startPeriod === 'AM' && styles.startPeriodButtonActive]}
            onPress={() => setStartPeriod('AM')}
          >
            <Text style={[styles.startPeriodButtonText, startPeriod === 'AM' && styles.startPeriodButtonTextActive]}>AM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.startPeriodButton, startPeriod === 'PM' && styles.startPeriodButtonActive]}
            onPress={() => setStartPeriod('PM')}
          >
            <Text style={[styles.startPeriodButtonText, startPeriod === 'PM' && styles.startPeriodButtonTextActive]}>PM</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>END TIME *</Text>
        <EndTimePicker value={endTime} onChange={setEndTime} />

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>LICENSE PLATE NUMBER *</Text>
        <View style={styles.plateRow}>
          <TextInput
            style={[styles.input, styles.plateStateInput]}
            placeholder="TX"
            placeholderTextColor="#888"
            value={plateState}
            onChangeText={setPlateState}
            autoCapitalize="characters"
            maxLength={2}
          />
          <TextInput
            style={[styles.input, styles.plateNumberInput]}
            placeholder="00000"
            placeholderTextColor="#888"
            value={plateNumber}
            onChangeText={setPlateNumber}
            autoCapitalize="characters"
          />
        </View>

        <TextInput
          style={styles.input}
          placeholder="PHONE NUMBER *"
          placeholderTextColor="#888"
          value={phoneNumber}
          onChangeText={(text) => setPhoneNumber(formatPhoneInput(text))}
          keyboardType="phone-pad"
          maxLength={14}
        />

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>PHOTO (OPTIONAL)</Text>
        <View style={styles.photosRow}>
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
              <Text style={styles.addPhotoText}>ADD</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>CONTINUE</Text>
        </TouchableOpacity>
      </ScrollView>
      <LotPickerModal
        visible={showLotPicker}
        onClose={() => setShowLotPicker(false)}
        onSelect={(lotName) => setSelectedLot(lotName)}
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
  input: {
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    padding: 16,
    color: '#333',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 14,
  },
  messageInput: {
    height: 120,
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
    marginBottom: 14,
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
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#888',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  sectionLabelSpaced: {
    marginTop: 6,
  },
  // Start Time: one unified container matching DDS2's single-field look —
  // numeric date/time input on the left, compact AM/PM toggle on the right,
  // both inside the same rounded box.
  startTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  startTimeInput: {
    flex: 1,
    paddingVertical: 16,
    color: '#333',
    fontSize: 14,
    fontWeight: '700',
  },
  startPeriodButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#fff',
    marginLeft: 4,
  },
  startPeriodButtonActive: {
    backgroundColor: '#00853E',
  },
  startPeriodButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  startPeriodButtonTextActive: {
    color: '#fff',
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
  photosRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  photoThumbWrap: {
    position: 'relative',
  },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 8,
  },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#D0021B',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoButton: {
    width: 90,
    height: 90,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#00853E',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoText: {
    color: '#00853E',
    fontSize: 11,
    fontWeight: '700',
  },
  continueButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00853E',
    borderRadius: 8,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  reviewLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  reviewLabelSpaced: {
    marginTop: 14,
  },
  reviewValue: {
    fontWeight: '400',
    fontStyle: 'italic',
    color: '#444',
  },
  photoRow: {
    flexDirection: 'row',
    marginTop: 14,
  },
  submitButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00853E',
    borderRadius: 8,
    marginTop: 22,
  },
  submitButtonDisabled: {
    backgroundColor: '#B5B5B5',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pendingHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
