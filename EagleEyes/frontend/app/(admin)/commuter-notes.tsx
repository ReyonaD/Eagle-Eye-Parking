import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Alert } from '../../utils/webCompat';

interface CommuterNote {
  id: string;
  reason: string;
  lot: string;
  detail: string;
  startTime: string;
  endTime: string;
  licensePlate: string;
  phoneNumber: string;
  photos: string[];
  isNew: boolean;
}

// MOCK DATA — matches the prototype's example notes. Replace with a real fetch
// (GET /alerts/pending?alert_type=event, or a dedicated notes endpoint once the
// backend collects start/end time, plate, and phone) and wire Acknowledge to a
// real dismiss/delete call once the backend supports these fields.
const MOCK_NOTES: CommuterNote[] = [
  {
    id: '1',
    reason: 'Broken Car',
    lot: 'Lot 20 - Eagle',
    detail: "I'm in Lot 20 and the car key is locked inside. Waiting on a family member to bring the spare, but I need to head to class.",
    startTime: '09/16 9:32 AM',
    endTime: '24 hour',
    licensePlate: 'EAGL392',
    phoneNumber: '940-555-0148',
    photos: ['Photo 1'],
    isNew: true,
  },
  {
    id: '2',
    reason: 'Flat Tire, Waiting on Tow',
    lot: 'Lot 39 - Eagle',
    detail: 'Got a flat tire pulling in this morning. Tow truck is on the way and should have it cleared within a few hours.',
    startTime: '09/17 6:50 AM',
    endTime: '4 hours',
    licensePlate: 'TXR8821',
    phoneNumber: '940-555-0193',
    photos: ['Photo 1'],
    isNew: true,
  },
  {
    id: '3',
    reason: 'Dead Battery',
    lot: 'Lot 13 - SV',
    detail: 'Battery died overnight. Getting a jump after my first class, should be resolved by mid-morning.',
    startTime: '09/17 7:40 AM',
    endTime: '2 hours',
    licensePlate: 'UNT4456',
    phoneNumber: '940-555-0207',
    photos: [],
    isNew: true,
  },
  {
    id: '4',
    reason: 'Out of Town on Game day',
    lot: 'Lot 7 - Eagle',
    detail: 'Traveling out of town for the game weekend — car will stay parked in the same spot the whole time.',
    startTime: '09/15 12:17 AM',
    endTime: '7 days',
    licensePlate: 'EGL7710',
    phoneNumber: '940-555-0164',
    photos: [],
    isNew: false,
  },
];

export default function CommuterNotesScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<CommuterNote[]>(MOCK_NOTES);
  const [selectedNote, setSelectedNote] = useState<CommuterNote | null>(null);

  const newNotes = notes.filter((n) => n.isNew);
  const olderNotes = notes.filter((n) => !n.isNew);

  const handleAcknowledge = (note: CommuterNote) => {
    // TODO: call the real dismiss/delete endpoint once this is wired to the backend.
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    setSelectedNote(null);
  };

  // Detail view — swapped in over the list rather than a separate route, so
  // "Back" here just returns to the list instead of leaving the screen.
  if (selectedNote) {
    return (
      <SafeAreaView style={styles.screen} edges={['right', 'left']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setSelectedNote(null)} hitSlop={10}>
            <Ionicons name="chevron-back" size={27} color="#00853E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Note Details</Text>
          <View style={{ width: 27 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Reason: <Text style={styles.fieldValue}>{selectedNote.reason}</Text></Text>

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Detail:</Text>
            <Text style={styles.fieldValue}>{selectedNote.detail}</Text>

            <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>
              Start time: <Text style={styles.fieldValue}>{selectedNote.startTime}</Text>
            </Text>
            <Text style={styles.fieldLabel}>
              End time: <Text style={styles.fieldValue}>{selectedNote.endTime}</Text>
            </Text>
            <Text style={styles.fieldLabel}>
              License Plate: <Text style={styles.fieldValue}>{selectedNote.licensePlate}</Text>
            </Text>
            <Text style={styles.fieldLabel}>
              Phone Number: <Text style={styles.fieldValue}>{selectedNote.phoneNumber}</Text>
            </Text>

            {selectedNote.photos.length > 0 && (
              <View style={styles.photoRow}>
                {selectedNote.photos.map((photo, index) => (
                  <View key={index} style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderText}>{photo}</Text>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.acknowledgeBtn}
              onPress={() => handleAcknowledge(selectedNote)}
              activeOpacity={0.7}
            >
              <Text style={styles.acknowledgeBtnText}>ACKNOWLEDGE</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(admin)/profile')} hitSlop={10}>
          <Ionicons name="chevron-back" size={27} color="#00853E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notes from Commuters</Text>
        <View style={{ width: 27 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Student updates on parked vehicles</Text>

        {notes.length === 0 ? (
          <Text style={styles.emptyText}>No notes from commuters right now.</Text>
        ) : (
          <>
            {newNotes.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, styles.sectionLabelNew]}>NEW</Text>
                {newNotes.map((note) => (
                  <NoteCard key={note.id} note={note} onPress={() => setSelectedNote(note)} />
                ))}
              </>
            )}
            {olderNotes.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>OLDER</Text>
                {olderNotes.map((note) => (
                  <NoteCard key={note.id} note={note} onPress={() => setSelectedNote(note)} />
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function NoteCard({ note, onPress }: { note: CommuterNote; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>{note.reason}</Text>
        <Text style={styles.cardLot}> {note.lot}</Text>
      </View>
      <Text style={styles.cardMeta}>Start: {note.startTime}</Text>
      <Text style={styles.cardMeta}>End: {note.endTime}</Text>
      <Text style={styles.cardHint}>Click for more details</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#888',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionLabelNew: {
    color: '#E74C3C',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1a1a1a',
  },
  cardLot: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#666',
  },
  cardMeta: {
    fontSize: 12,
    color: '#555',
    fontWeight: '600',
    marginBottom: 4,
  },
  cardHint: {
    fontSize: 10,
    fontStyle: 'italic',
    color: '#999',
    fontWeight: 'bold',
    textAlign: 'right',
    marginTop: 6,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  fieldLabelSpaced: {
    marginTop: 14,
  },
  fieldValue: {
    fontWeight: '400',
    fontStyle: 'italic',
    color: '#444',
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  acknowledgeBtn: {
    backgroundColor: '#00853E',
    paddingVertical: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  acknowledgeBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1,
  },
});
