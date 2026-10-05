import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { createAlert } from '../api/alerts';
import LotPickerModal from '../components/LotPickerModal';
import DatePickerModal from '../components/DatePickerModal';
import { Alert } from '../utils/webCompat';

//"YYYY-MM-DD" (react-native-calendars' dateString) -> "Mon D, YYYY"
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[Number(month) - 1] ?? '';
  return `${m} ${Number(day)}, ${year}`;
};

export default function ReportNoteScreen() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selectedLot, setSelectedLot] = useState<string | null>(null);
  const [showLotPicker, setShowLotPicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeDateField, setActiveDateField] = useState<'start' | 'end' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) {
      Alert.alert('Missing information', 'Add a subject and a message before submitting.');
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
      await createAlert({
        title: title.trim(),
        alert_type: 'event',
        category: 'Note to Admin',
        description: message.trim(),
        lot_name: selectedLot || undefined,
        event_start: new Date(sy, sm - 1, sd).toISOString(),
        event_end: new Date(ey, em - 1, ed).toISOString(),
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