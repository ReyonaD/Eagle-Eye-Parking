import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { uploadAlertImage } from '../api/alerts';
import { createNote } from '../api/notes';
import LotPickerModal from '../components/LotPickerModal';
import DatePickerModal from '../components/DatePickerModal';
import EndTimePicker, {
  DEFAULT_END_TIME,
  EndTimeValue,
  Period,
  isValidTimeHHMM,
  isEndTimeValid,
} from '../components/EndTimePicker';
import ToggleChip from '../components/ToggleChip';
import TimePickerField from '../components/TimePickerField';
import { useUser } from '../context/UserContext';
import { Alert } from '../utils/webCompat';

type PickedPhoto = { uri: string; file?: File };

//Standard US 10-digit phone number, formatted as (XXX) XXX-XXXX while typing.
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

//"H:MM" + AM/PM -> 24h hours/minutes, or null if malformed
function parseHMM(value: string, period: Period): { hours: number; minutes: number } | null {
  const m = value.trim().match(/^(0?[1-9]|1[0-2]):([0-5]\d)$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
}

//"YYYY-MM-DD" (react-native-calendars' dateString) -> "Mon D, YYYY"
function formatDateDisplay(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[Number(month) - 1] ?? '';
  return `${m} ${Number(day)}, ${year}`;
}

export default function ReportNoteScreen() {
  const { user } = useUser();
  const [step, setStep] = useState<'form' | 'review'>('form');

  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [showLotPicker, setShowLotPicker] = useState(false);
  //"YYYY-MM-DD" from the calendar picker
  const [startDate, setStartDate] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [startPeriod, setStartPeriod] = useState<Period>('AM');
  //"All day" skips the start time - the note starts at midnight
  const [startAllDay, setStartAllDay] = useState(false);
  const [endTime, setEndTime] = useState<EndTimeValue>(DEFAULT_END_TIME);
  const [plateState, setPlateState] = useState(user.parkingProfile.plateState);
  const [plateNumber, setPlateNumber] = useState(user.parkingProfile.plateNumber);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (!startDate) {
      Alert.alert('Missing information', 'Pick a start date.');
      return;
    }
    if (!startAllDay && !isValidTimeHHMM(startTime)) {
      Alert.alert('Missing start time', 'Pick a start time, or choose All day.');
      return;
    }
    if (!isEndTimeValid(endTime)) {
      Alert.alert('Missing end time', 'Pick a custom end date and time.');
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
      case 'custom':
        return `${endTime.customDate ? formatDateDisplay(endTime.customDate) : 'Select a date'} ${endTime.customTime || '--:--'} ${endTime.customPeriod}`;
    }
  })();

  //already format/presence-validated by handleContinue before the review
  //step is reachable, so this only needs to turn them into real Dates
  const resolveEventWindow = (): { eventStart: Date; eventEnd: Date } | null => {
    const startTimeParsed = startAllDay ? { hours: 0, minutes: 0 } : parseHMM(startTime, startPeriod);
    if (!startDate || !startTimeParsed) return null;

    const [sy, sm, sd] = startDate.split('-').map(Number);
    const eventStart = new Date(sy, sm - 1, sd);
    eventStart.setHours(startTimeParsed.hours, startTimeParsed.minutes, 0, 0);

    let eventEnd: Date;
    switch (endTime.mode) {
      case '24hr':
        eventEnd = new Date(eventStart.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'endOfDay':
        eventEnd = new Date(eventStart);
        eventEnd.setHours(23, 59, 0, 0);
        break;
      case 'overnight':
        //until 8:00 AM the next day - the common campus overnight-parking cutoff
        eventEnd = new Date(eventStart);
        eventEnd.setDate(eventEnd.getDate() + 1);
        eventEnd.setHours(8, 0, 0, 0);
        break;
      case 'custom': {
        const customTimeParsed = parseHMM(endTime.customTime, endTime.customPeriod);
        if (!endTime.customDate || !customTimeParsed) return null;
        const [ey, em, ed] = endTime.customDate.split('-').map(Number);
        eventEnd = new Date(ey, em - 1, ed);
        eventEnd.setHours(customTimeParsed.hours, customTimeParsed.minutes, 0, 0);
        break;
      }
    }
    return { eventStart, eventEnd };
  };

  const handleSubmit = async () => {
    const window = resolveEventWindow();
    if (!window) {
      Alert.alert('Invalid dates', 'Could not read the start/end time. Please re-check them.');
      return;
    }
    if (window.eventEnd <= window.eventStart) {
      Alert.alert('Invalid end time', 'The custom end time must be after the start time.');
      return;
    }

    setSubmitting(true);
    try {
      const imageUrls: string[] = [];
      if (photo) {
        const { image_url } = await uploadAlertImage(photo);
        imageUrls.push(image_url);
      }

      await createNote({
        title: reason.trim(),
        description: detail.trim() || undefined,
        lot_name: selectedLot || undefined,
        event_start: window.eventStart.toISOString(),
        event_end: window.eventEnd.toISOString(),
        phone_number: phoneNumber,
        plate_state: plateState.trim(),
        plate_number: plateNumber.trim(),
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

  if (step === 'review') {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'right', 'left']}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack} disabled={submitting}>
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
              Start time: <Text style={styles.reviewValue}>{formatDateDisplay(startDate)} {startAllDay ? '· All day' : `${startTime} ${startPeriod}`}</Text>
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

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>SUBMIT</Text>
              )}
            </TouchableOpacity>
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

        <Text style={styles.sectionLabel}>START DATE *</Text>
        <TouchableOpacity style={styles.lotButton} onPress={() => setShowStartDatePicker(true)}>
          <View style={styles.lotButtonLabel}>
            <Ionicons name="calendar-outline" size={18} color={startDate ? '#00853E' : '#888'} />
            <Text style={[styles.lotButtonText, startDate && styles.selectedLotText]}>
              {startDate ? formatDateDisplay(startDate) : 'SELECT START DATE'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#888" />
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>START TIME *</Text>
        <View style={styles.allDayRow}>
          <ToggleChip
            label="All day"
            value={startAllDay}
            onChange={(value) => {
              setStartAllDay(value);
              //an all-day note most often ends with the day too
              if (value && endTime.mode === '24hr') setEndTime({ ...endTime, mode: 'endOfDay' });
            }}
          />
        </View>
        {!startAllDay && (
          <TimePickerField
            time={startTime}
            period={startPeriod}
            onChange={(t, p) => { setStartTime(t); setStartPeriod(p); }}
            placeholder="SELECT START TIME"
            title="Start time"
          />
        )}

        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>ESTIMATED END TIME *</Text>
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
      <DatePickerModal
        visible={showStartDatePicker}
        onClose={() => setShowStartDatePicker(false)}
        onSelect={(dateString) => setStartDate(dateString)}
        initialDate={startDate || undefined}
        title="Select start date"
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
  //Start Time: one unified container - numeric date/time input on the left,
  //compact AM/PM toggle on the right, both inside the same rounded box.
  allDayRow: {
    flexDirection: 'row',
    marginBottom: 10,
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
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
