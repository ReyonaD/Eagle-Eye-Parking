import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Platform, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../../utils/webCompat';
import { BASE_URL } from '../../api/alerts';
import { getNotes, acknowledgeNote } from '../../api/notes';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import {
  parseUTC, toLocalDateString, getTodayDateString, formatDate, getEventRange,
  classifyNote, NoteBucket,
} from '../../utils/eventDates';

const IS_WEB = Platform.OS === 'web';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getYesterdayDateString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toLocalDateString(d);
};

const formatDateTime = (isoString?: string | null) => {
  if (!isoString) return 'Not specified';
  const local = parseUTC(isoString);
  const dateStr = toLocalDateString(local);
  const time = local.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).replace(' ', '');
  if (dateStr === getTodayDateString()) return `TODAY ${time}`;
  if (dateStr === getYesterdayDateString()) return `YESTERDAY ${time}`;
  return `${dateStr} ${time}`;
};

type Bucket = NoteBucket;
const classify = classifyNote;

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({ note, bucket, onPress }: { note: any; bucket: Bucket; onPress: () => void }) {
  const { end } = getEventRange(note);
  const isExpired = bucket === 'expired';
  return (
    <TouchableOpacity
      style={[styles.card, isExpired && styles.cardOlder]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.cardContent}>
        <View style={styles.iconBox}>
          <Ionicons name="document-text-outline" size={22} color="#00853E" />
        </View>
        <View style={styles.cardText}>
          <Text style={[styles.cardTitle, isExpired && styles.olderText]} numberOfLines={1}>
            {note.title}
          </Text>
          {!!note.lot_name && (
            <Text style={[styles.cardLot, isExpired && styles.olderText]} numberOfLines={1}>
              📍 {note.lot_name}
            </Text>
          )}
          <Text style={[styles.cardTime, isExpired && styles.olderText]}>
            {isExpired ? 'EXPIRED ' : 'UNTIL '}{formatDate(toLocalDateString(end))}
          </Text>
          <Text style={styles.clickDetails}>CLICK FOR DETAILS</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── NoteColumn (web three-column layout) ──────────────────────────────────────

function NoteColumn({
  title,
  accentColor,
  notes,
  bucket,
  onPress,
  emptyText,
}: {
  title: string;
  accentColor: string;
  notes: any[];
  bucket: Bucket;
  onPress: (n: any) => void;
  emptyText: string;
}) {
  return (
    <View style={[styles.webColumn, { borderLeftColor: accentColor }]}>
      <Text style={[styles.webColumnTitle, { color: accentColor }]}>
        {title} ({notes.length})
      </Text>
      <ScrollView style={styles.webColumnScroll} contentContainerStyle={styles.webColumnScrollContent}>
        {notes.length === 0 ? (
          <Text style={styles.emptyText}>{emptyText}</Text>
        ) : (
          notes.map(n => <NoteCard key={n.id} note={n} bucket={bucket} onPress={() => onPress(n)} />)
        )}
      </ScrollView>
    </View>
  );
}

// ─── NoteDetail ───────────────────────────────────────────────────────────────

function NoteDetail({
  note,
  bucket,
  onBack,
  onAcknowledge,
}: {
  note: any;
  bucket: Bucket;
  onBack: () => void;
  onAcknowledge: (n: any) => void;
}) {
  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          {!IS_WEB && <Ionicons name="chevron-back" size={20} color="#00853E" />}
          <Text style={styles.backText}>{IS_WEB ? 'Back to list' : 'Back'}</Text>
        </TouchableOpacity>

        <Text style={styles.detailTitle}>{note.title}</Text>
        <Text style={styles.detailTime}>SUBMITTED {formatDateTime(note.created_at)}</Text>

        <View style={styles.detailCard}>
          <Text style={styles.locationLabel}>
            LOT: <Text style={styles.locationValue}>{note.lot_name ?? 'Not specified'}</Text>
          </Text>
          <Text style={styles.locationLabel}>
            PHONE: <Text style={styles.locationValue}>{note.phone_number || 'Not provided'}</Text>
          </Text>
          <Text style={styles.locationLabel}>MESSAGE:</Text>
          <Text style={styles.locationValue}>{note.description || 'No message provided'}</Text>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.locationLabel}>
            START: <Text style={styles.locationValue}>{formatDateTime(note.event_start)}</Text>
          </Text>
          <Text style={styles.locationLabel}>
            END: <Text style={styles.locationValue}>{formatDateTime(note.event_end)}</Text>
          </Text>
        </View>

        {Array.isArray(note.image_urls) && note.image_urls.length > 0 && (
          <View style={styles.photoRow}>
            {note.image_urls.map((url: string) => (
              <Image key={url} source={{ uri: `${BASE_URL}${url}` }} style={styles.photoThumb} />
            ))}
          </View>
        )}

        {!!note.reporter_email && (
          <Text style={styles.reporterEmails} numberOfLines={2}>
            REPORTED BY: {note.reporter_email}
          </Text>
        )}
      </ScrollView>

      {bucket === 'pending' && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.acknowledgeButton} onPress={() => onAcknowledge(note)}>
            <Text style={styles.actionButtonText}>ACKNOWLEDGE</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const byCreatedAsc = (a: any, b: any) => parseUTC(a.created_at).getTime() - parseUTC(b.created_at).getTime();
const byEndAsc = (a: any, b: any) => getEventRange(a).end.getTime() - getEventRange(b).end.getTime();
const byEndDesc = (a: any, b: any) => getEventRange(b).end.getTime() - getEventRange(a).end.getTime();

export default function CommuterNotesScreen() {
  const router = useRouter();
  const { viewId } = useLocalSearchParams<{ viewId?: string }>();
  const [notes, setNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);

  const fetchNotes = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      setNotes(await getNotes());
    } catch {
      Alert.alert('Error', 'Could not load notes from commuters.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchNotes(false);
    setIsRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => { fetchNotes(); }, [])
  );
  //keep the queue fresh while the admin is looking at it
  useFocusPolling(() => fetchNotes(false));

  //the Expired-notes history page deep-links back here with ?viewId=<id>
  const viewHandledRef = useRef(false);
  useEffect(() => {
    if (!viewId || viewHandledRef.current) return;
    const found = notes.find(n => String(n.id) === String(viewId));
    if (found) {
      viewHandledRef.current = true;
      setSelectedNote(found);
    }
  }, [viewId, notes]);

  const pendingNotes = notes.filter(n => classify(n) === 'pending').sort(byCreatedAsc);
  const activeNotes = notes.filter(n => classify(n) === 'active').sort(byEndAsc);
  const expiredNotes = notes.filter(n => classify(n) === 'expired').sort(byEndDesc);

  const handleAcknowledge = async (note: any) => {
    try {
      await acknowledgeNote(note.id);
      setSelectedNote(null);
      fetchNotes();
    } catch {
      Alert.alert('Error', 'Could not acknowledge this note. Check your connection.');
    }
  };

  if (selectedNote) {
    return (
      <SafeAreaView style={styles.screen} edges={['right', 'left']}>
        <NoteDetail
          note={selectedNote}
          bucket={classify(selectedNote)}
          onBack={() => setSelectedNote(null)}
          onAcknowledge={handleAcknowledge}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      {/* web is reached from the sidebar, not a navigation stack, so a page
          title replaces the mobile-style back header */}
      {!IS_WEB && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/(admin)/profile')} hitSlop={10}>
            <Ionicons name="chevron-back" size={27} color="#00853E" />
          </TouchableOpacity>
          {/* matches the approved prototype's measured scale/color for this title */}
          <Text style={[styles.headerTitle, styles.headerTitleGreen]}>Notes from Commuters</Text>
          <View style={{ width: 27 }} />
        </View>
      )}

      {IS_WEB ? (
        <View style={styles.webScreen}>
          <Text style={styles.screenTitle}>Notes from Commuters</Text>
          <Text style={styles.subtitle}>Student updates on parked vehicles</Text>
          {isLoading ? (
            <ActivityIndicator size="large" color="#00853E" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.webColumnsRow}>
              <NoteColumn
                title="ACKNOWLEDGMENT PENDING"
                accentColor="#E74C3C"
                notes={pendingNotes}
                bucket="pending"
                onPress={setSelectedNote}
                emptyText="Nothing waiting on review."
              />
              <NoteColumn
                title="ACTIVE"
                accentColor="#00853E"
                notes={activeNotes}
                bucket="active"
                onPress={setSelectedNote}
                emptyText="No active notes."
              />
              <NoteColumn
                title="EXPIRED"
                accentColor="#999"
                notes={expiredNotes}
                bucket="expired"
                onPress={setSelectedNote}
                emptyText="No expired notes."
              />
            </View>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listScroll}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00853E" />}
        >
          <Text style={styles.subtitle}>Student updates on parked vehicles</Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#00853E" style={{ marginTop: 40 }} />
          ) : (
            <>
              {pendingNotes.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>ACKNOWLEDGMENT PENDING</Text>
                  {pendingNotes.map(n => (
                    <NoteCard key={n.id} note={n} bucket="pending" onPress={() => setSelectedNote(n)} />
                  ))}
                </>
              ) : (
                <Text style={styles.emptyText}>Nothing waiting on review.</Text>
              )}

              {activeNotes.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, styles.activeLabel]}>ACTIVE</Text>
                  {activeNotes.map(n => (
                    <NoteCard key={n.id} note={n} bucket="active" onPress={() => setSelectedNote(n)} />
                  ))}
                </>
              )}

              {expiredNotes.length > 0 && (
                <TouchableOpacity
                  style={styles.historyLinkButton}
                  onPress={() => router.push('/(admin)/notes-history')}
                >
                  <Ionicons name="time-outline" size={20} color="#999" />
                  <Text style={styles.historyLinkText}>VIEW EXPIRED NOTES</Text>
                  <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#f5f5f5',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  //matches the approved prototype's measured scale for this title
  headerTitleGreen: { fontSize: 26, color: '#00853E' },
  screenTitle: { fontSize: 26, fontWeight: 'bold', color: '#00853E', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, marginTop: 16, paddingHorizontal: 16 },

  // List
  listScroll: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#E74C3C',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 8,
  },
  activeLabel: { color: '#00853E' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardOlder: { opacity: 0.65 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#e8f5ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a1a', marginBottom: 2 },
  cardLot: { fontSize: 12, color: '#00853E', fontWeight: '600', marginTop: 2 },
  cardTime: { fontSize: 12, color: '#555', fontWeight: '600', marginTop: 4, textTransform: 'uppercase' },
  clickDetails: { fontSize: 10, color: '#999', fontStyle: 'italic', fontWeight: 'bold', marginTop: 4 },
  olderText: { color: '#999' },
  emptyText: { fontSize: 14, color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: 40 },

  historyLinkButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  historyLinkText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#333', letterSpacing: 0.5 },

  // Web: three-column Acknowledgment Pending / Active / Expired layout, each
  // box bounded to the screen with its own internal scroll
  webScreen: { flex: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  webColumnsRow: { flex: 1, flexDirection: 'row', gap: 20 },
  webColumn: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  webColumnTitle: {
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
  },
  webColumnScroll: { flex: 1 },
  webColumnScrollContent: { paddingHorizontal: 16, paddingBottom: 16 },

  // Detail
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { color: '#00853E', fontSize: 16, fontWeight: '600' },
  detailTitle: { fontSize: 28, fontWeight: '900', color: '#1a1a1a', marginBottom: 4 },
  detailTime: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  locationLabel: { fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', marginBottom: 14 },
  locationValue: { fontWeight: '400', textTransform: 'none', color: '#333' },
  reporterEmails: { fontSize: 12, color: '#777', marginTop: 4 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  photoThumb: { width: 100, height: 100, borderRadius: 8, backgroundColor: '#e8e8e8' },
  actionRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  acknowledgeButton: {
    backgroundColor: '#00853E',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
});
