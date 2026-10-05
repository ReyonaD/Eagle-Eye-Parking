import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getPendingAlerts } from '../../api/alerts';
import { Alert } from '../../utils/webCompat';
import { toLocalDateString, formatDate, getEventRange } from '../../utils/eventDates';

const PAGE_SIZE = 15;

//mobile-only companion to the Notes from Commuters screen: Expired notes
//link here instead of listing inline, so the main screen stays focused on
//Acknowledgment Pending / Active. Loads a bounded page at a time via LOAD
//MORE rather than rendering the whole history at once.
export default function NotesHistoryScreen() {
  const [notes, setNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchNotes = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const all = await getPendingAlerts('event').catch(() => []);
      const now = Date.now();
      const expired = all
        .filter((n: any) => n.category === 'Note to Admin' && getEventRange(n).end.getTime() < now)
        .sort((a: any, b: any) => getEventRange(b).end.getTime() - getEventRange(a).end.getTime());
      setNotes(expired);
    } catch {
      Alert.alert('Error', 'Could not load expired notes.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchNotes(false);
    setIsRefreshing(false);
  };

  const visibleNotes = notes.slice(0, visibleCount);
  const hasMore = visibleCount < notes.length;

  //hands off to the Notes screen's own detail view (read-only for expired
  //notes), never duplicating that UI here
  const handleViewNote = (noteId: number) => {
    router.push({ pathname: '/(admin)/commuter-notes', params: { viewId: String(noteId) } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={27} color="#00853E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expired Notes</Text>
        <View style={{ width: 27 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00853E" />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#00853E" style={{ marginTop: 40 }} />
        ) : notes.length === 0 ? (
          <Text style={styles.emptyText}>No expired notes.</Text>
        ) : (
          <>
            {visibleNotes.map(note => {
              const { end } = getEventRange(note);
              return (
                <TouchableOpacity key={note.id} style={styles.card} onPress={() => handleViewNote(note.id)}>
                  <View style={styles.iconBox}>
                    <Ionicons name="document-text-outline" size={22} color="#999" />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{note.title}</Text>
                    <Text style={styles.cardMeta}>
                      Expired {formatDate(toLocalDateString(end))} · {note.lot_name || 'No lot specified'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
              );
            })}
            {hasMore && (
              <TouchableOpacity style={styles.loadMoreButton} onPress={() => setVisibleCount(v => v + PAGE_SIZE)}>
                <Text style={styles.loadMoreText}>LOAD MORE ({notes.length - visibleCount} left)</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
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
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  content: { padding: 16, paddingBottom: 40 },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 14, fontStyle: 'italic', marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    opacity: 0.8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a1a' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  loadMoreButton: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#E8F5EE',
    marginTop: 8,
  },
  loadMoreText: { fontSize: 13, fontWeight: '800', color: '#00853E', letterSpacing: 0.5 },
});
