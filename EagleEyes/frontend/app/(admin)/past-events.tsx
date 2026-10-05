import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAlerts } from '../../api/alerts';
import { Alert } from '../../utils/webCompat';
import { getEventVisual } from '../../utils/alertVisuals';
import { getEventRange, toLocalDateString, getTodayDateString, formatDate } from '../../utils/eventDates';

//mobile-only companion to the Campus Events screen: a dedicated page to browse
//already-finished events and reuse one (prefill + pick a new date) instead of
//retyping a recurring event from scratch every time
export default function PastEventsScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchEvents = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await getAlerts('event');
      setEvents(data);
    } catch {
      Alert.alert('Error', 'Could not load past events.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchEvents(false);
    setIsRefreshing(false);
  };

  const today = getTodayDateString();
  const pastEvents = events
    .filter(eventItem => toLocalDateString(getEventRange(eventItem).end) < today)
    .sort((a, b) => getEventRange(b).end.getTime() - getEventRange(a).end.getTime());

  //hands off to the Events screen's own Add Event form, prefilled - picking
  //the new date happens there, never on this page
  const handleReuse = (eventItem: any) => {
    router.push({ pathname: '/(admin)/events', params: { reuseId: String(eventItem.id) } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={27} color="#00853E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Past Events</Text>
        <View style={{ width: 27 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00853E" />}
      >
        <Text style={styles.subtitle}>Tap REUSE to recreate an event with a new date</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#00853E" style={{ marginTop: 40 }} />
        ) : pastEvents.length === 0 ? (
          <Text style={styles.emptyText}>No past events yet.</Text>
        ) : (
          pastEvents.map(eventItem => {
            const visual = getEventVisual(eventItem.category);
            const { end } = getEventRange(eventItem);
            return (
              <View key={eventItem.id} style={styles.card}>
                <View style={[styles.iconBox, { backgroundColor: visual.bg }]}>
                  <Ionicons name={visual.icon as any} size={22} color={visual.iconColor} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{eventItem.title}</Text>
                  <Text style={styles.cardMeta}>{eventItem.category} · {formatDate(toLocalDateString(end))}</Text>
                </View>
                <TouchableOpacity style={styles.reuseButton} onPress={() => handleReuse(eventItem)}>
                  <Ionicons name="refresh" size={14} color="#00853E" />
                  <Text style={styles.reuseButtonText}>REUSE</Text>
                </TouchableOpacity>
              </View>
            );
          })
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
  subtitle: { fontSize: 14, color: '#666', marginBottom: 16 },
  emptyText: { textAlign: 'center', color: '#999', fontSize: 14, fontStyle: 'italic', marginTop: 40 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  iconBox: { width: 46, height: 46, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a1a' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  reuseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E8F5EE',
  },
  reuseButtonText: { fontSize: 11, fontWeight: '800', color: '#00853E', letterSpacing: 0.5 },
});
