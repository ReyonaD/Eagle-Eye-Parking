import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { getAlerts, getDeclinedAlerts } from '../../api/alerts';
import { Alert } from '../../utils/webCompat';
import { getHazardVisual } from '../../utils/alertVisuals';
import AlertIcon from '../../components/AlertIcon';
import { isHazardActive } from '../../utils/lotStatus';

const PAGE_SIZE = 15;

//backend stores timestamps in UTC but serializes them without a "Z" suffix
const parseUTC = (isoString: string) =>
  new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(isoString) ? isoString : `${isoString}Z`);

//mobile-only companion to the Hazard Reports screen: Published and Declined
//each link here instead of listing inline, so the main screen stays focused
//on the actionable Pending queue. Loads a bounded page at a time via LOAD MORE
//rather than rendering the whole (potentially long-running) history at once.
export default function HazardHistoryScreen() {
  const { status } = useLocalSearchParams<{ status?: string }>();
  const isDeclined = status === 'declined';

  const [hazards, setHazards] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const fetchHazards = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = isDeclined ? await getDeclinedAlerts('hazard') : await getAlerts('hazard');
      setHazards(data);
    } catch {
      Alert.alert('Error', 'Could not load hazard reports.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHazards();
    setVisibleCount(PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDeclined]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchHazards(false);
    setIsRefreshing(false);
  };

  const visibleHazards = hazards.slice(0, visibleCount);
  const hasMore = visibleCount < hazards.length;

  //hands off to the Hazards screen's own detail view (edit/approve/remove),
  //never duplicating that UI here
  const handleViewHazard = (hazardId: number) => {
    router.push({ pathname: '/(admin)/hazards', params: { viewId: String(hazardId) } });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={27} color="#00853E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isDeclined ? 'Declined Hazards' : 'Published Hazards'}</Text>
        <View style={{ width: 27 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#00853E" />}
      >
        {isLoading ? (
          <ActivityIndicator size="large" color="#00853E" style={{ marginTop: 40 }} />
        ) : hazards.length === 0 ? (
          <Text style={styles.emptyText}>
            {isDeclined ? 'No declined hazards.' : 'No published hazards yet.'}
          </Text>
        ) : (
          <>
            {visibleHazards.map(hazard => {
              const visual = getHazardVisual(hazard.category);
              return (
                <TouchableOpacity key={hazard.id} style={styles.card} onPress={() => handleViewHazard(hazard.id)}>
                  <View style={[styles.iconBox, { backgroundColor: visual.bg }]}>
                    <AlertIcon visual={visual} size={22} />
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{hazard.title}</Text>
                    <Text style={styles.cardMeta}>
                      {parseUTC(hazard.created_at).toLocaleDateString()} · {hazard.lot_name || 'No lot specified'}
                    </Text>
                    {!isDeclined && (
                      <Text style={[styles.cardMeta, { color: isHazardActive(hazard) ? '#00853E' : '#999', fontWeight: '700' }]}>
                        {isHazardActive(hazard) ? 'Active on map' : 'Inactive'}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#999" />
                </TouchableOpacity>
              );
            })}
            {hasMore && (
              <TouchableOpacity style={styles.loadMoreButton} onPress={() => setVisibleCount(v => v + PAGE_SIZE)}>
                <Text style={styles.loadMoreText}>LOAD MORE ({hazards.length - visibleCount} left)</Text>
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
