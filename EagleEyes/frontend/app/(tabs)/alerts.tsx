import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import { getAlerts, BASE_URL } from '../../api/alerts';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getAlertVisual, getCategoryLabel } from '../../utils/alertVisuals';

type FilterType = 'All' | 'Hazard' | 'Event';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  time: string;
  createdAt: string;
  section: 'Today' | 'Yesterday' | 'Earlier';
  alertType: 'hazard' | 'event';
  category?: string;
  lotName?: string;
  imageUrls?: string[];
}

//backend timestamps are UTC without a "Z" suffix; normalize before parsing
function parseUTC(isoString: string): Date {
  return new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(isoString) ? isoString : `${isoString}Z`);
}

//"2h" / "1d" style label from a backend timestamp
function timeAgo(createdAt: string): string {
  const ms = Date.now() - parseUTC(createdAt).getTime();
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

//"Sep 29, 2026 · 3:45 PM" style label for the detail view
function formatFullDateTime(createdAt: string): string {
  const d = parseUTC(createdAt);
  const datePart = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const timePart = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function sectionFor(createdAt: string): AlertItem['section'] {
  const created = parseUTC(createdAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  if (created >= startOfToday) return 'Today';
  if (created >= startOfYesterday) return 'Yesterday';
  return 'Earlier';
}

//map a backend alert (id, title, alert_type, category, description, upvotes, created_at)
//into the shape this screen's design renders
function toAlertItem(raw: any): AlertItem {
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description || raw.category || '',
    time: timeAgo(raw.created_at),
    createdAt: raw.created_at,
    section: sectionFor(raw.created_at),
    alertType: raw.alert_type === 'event' ? 'event' : 'hazard',
    category: raw.category || undefined,
    lotName: raw.lot_name || undefined,
    imageUrls: Array.isArray(raw.image_urls) && raw.image_urls.length ? raw.image_urls : undefined,
  };
}

function AlertsHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={27} color="#00853E" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Alerts</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function FilterTabs({
  selected,
  onSelect,
}: {
  selected: FilterType;
  onSelect: (value: FilterType) => void;
}) {
  const tabs: FilterType[] = ['All', 'Hazard', 'Event'];

  return (
    <View style={styles.filterHeader}>
      <View style={styles.filterRow}>
        {tabs.map((tab) => {
          const active = selected === tab;

          return (
            <TouchableOpacity
              key={tab}
              style={[styles.filterBtn, active && styles.filterBtnActive]}
              onPress={() => onSelect(tab)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.filterBtnText, active && styles.filterBtnTextActive]}
                numberOfLines={1}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function CollapsibleSectionHeader({
  title,
  count,
  expanded,
  onToggle,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.collapsibleSectionHeader}
      onPress={onToggle}
      activeOpacity={0.6}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${title.toLowerCase()} alerts`}
      accessibilityHint={`${count} alert${count === 1 ? '' : 's'}`}
    >
      <Text style={styles.sectionTitle}>
        {title} <Text style={styles.collapsibleCount}>({count})</Text>
      </Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#94A3B8" />
    </TouchableOpacity>
  );
}

function AlertCard({ alert, onPress }: { alert: AlertItem; onPress: () => void }) {
  const visual = getAlertVisual(alert.alertType, alert.category);
  const thumbnailUrl = alert.imageUrls?.[0];
  const extraPhotoCount = (alert.imageUrls?.length ?? 0) - 1;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon as any} size={27} color={visual.iconColor} />
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{alert.title}</Text>

        {!!alert.lotName && (
          <View style={styles.lotRow}>
            <Ionicons name="location" size={13} color="#00853E" />
            <Text style={styles.lotText}>{alert.lotName}</Text>
          </View>
        )}

        <View style={styles.cardTimeRow}>
          <Ionicons name="time-outline" size={13} color="#94A3B8" />
          <Text style={styles.cardTime}>{alert.time} ago</Text>
        </View>
      </View>

      {!!thumbnailUrl && (
        <View style={styles.cardThumbWrap}>
          <Image source={{ uri: `${BASE_URL}${thumbnailUrl}` }} style={styles.cardThumb} />
          {extraPhotoCount > 0 && (
            <View style={styles.cardThumbBadge}>
              <Text style={styles.cardThumbBadgeText}>+{extraPhotoCount}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function AlertDetail({ alert, onBack }: { alert: AlertItem; onBack: () => void }) {
  const visual = getAlertVisual(alert.alertType, alert.category);
  const categoryLabel = getCategoryLabel(alert.alertType, alert.category);
  const eyebrowLabel = alert.alertType === 'event' ? 'CAMPUS EVENT' : 'HAZARD REPORT';
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  //secondary facts live in the card below; type/category/time already read
  //at a glance from the header above, so they aren't repeated here
  const infoRows: { label: string; value: string }[] = [
    { label: 'Reported', value: formatFullDateTime(alert.createdAt) },
  ];
  if (alert.lotName) infoRows.push({ label: 'Lot', value: alert.lotName });
  if (alert.alertType === 'hazard') {
    infoRows.push({ label: 'Approved by', value: 'UNT Transportation Services' });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'left']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={27} color="#00853E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alert Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.detailContent}>
        <View style={styles.detailIconRow}>
          <View style={[styles.iconWrap, styles.detailIconWrap, { backgroundColor: visual.bg }]}>
            <Ionicons name={visual.icon as any} size={30} color={visual.iconColor} />
          </View>
          <View style={styles.detailTitleWrap}>
            <Text style={[styles.detailEyebrow, { color: visual.iconColor }]}>{eyebrowLabel}</Text>
            <Text style={styles.detailTitle}>{alert.title}</Text>
            <View style={styles.detailMetaRow}>
              <View style={[styles.detailCategoryPill, { backgroundColor: visual.bg }]}>
                <Text style={[styles.detailCategoryPillText, { color: visual.iconColor }]}>
                  {categoryLabel}
                </Text>
              </View>
              <Text style={styles.detailTime}>{alert.time} ago</Text>
            </View>
          </View>
        </View>

        <View style={styles.detailInfoCard}>
          {infoRows.map((row, index) => (
            <View
              key={row.label}
              style={[styles.detailInfoRow, index === infoRows.length - 1 && styles.detailInfoRowLast]}
            >
              <Text style={styles.detailInfoLabel}>{row.label}</Text>
              <Text style={styles.detailInfoValue}>{row.value}</Text>
            </View>
          ))}
        </View>

        {!!alert.description && (
          <>
            <Text style={styles.detailSectionLabel}>Description</Text>
            <Text style={styles.detailDescription}>{alert.description}</Text>
          </>
        )}

        {!!alert.imageUrls?.length && (
          <>
            <Text style={styles.detailSectionLabel}>Photos</Text>
            <View style={styles.detailPhotoGrid}>
              {alert.imageUrls.map((url) => (
                <TouchableOpacity key={url} onPress={() => setPreviewUri(`${BASE_URL}${url}`)} activeOpacity={0.85}>
                  <Image source={{ uri: `${BASE_URL}${url}` }} style={styles.detailPhoto} />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewUri(null)}
        >
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

export default function AlertsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('All');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  //older alerts stay tucked away until the user asks to see them
  const [earlierExpanded, setEarlierExpanded] = useState(false);

  const loadAlerts = useCallback(async () => {
    try {
      //the feed is split by type on the backend, so fetch both and merge
      const [hazards, events] = await Promise.all([
        getAlerts('hazard'),
        getAlerts('event'),
      ]);
      const merged = [...hazards, ...events]
        .map(toAlertItem)
        .sort((a, b) => Number(b.id) - Number(a.id));
      setAlerts(merged);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  }, [loadAlerts]);

  const filteredAlerts = useMemo(() => {
    switch (filter) {
      case 'Hazard':
        return alerts.filter((alert) => alert.alertType === 'hazard');
      case 'Event':
        return alerts.filter((alert) => alert.alertType === 'event');
      default:
        return alerts;
    }
  }, [filter, alerts]);

  //switching filters collapses Earlier again instead of leaving a stale expanded state
  useEffect(() => {
    setEarlierExpanded(false);
  }, [filter]);

  const handleToggleEarlier = useCallback(() => {
    setEarlierExpanded((prev) => !prev);
  }, []);

  const todayItems = filteredAlerts.filter((a) => a.section === 'Today');
  const yesterdayItems = filteredAlerts.filter((a) => a.section === 'Yesterday');
  const earlierItems = filteredAlerts.filter((a) => a.section === 'Earlier');

  const listData: any[] = [];
  if (todayItems.length) {
    listData.push({ id: 'TODAY-header', kind: 'header', label: 'TODAY' });
    todayItems.forEach((a) => listData.push({ ...a, kind: 'alert' }));
  }
  if (yesterdayItems.length) {
    listData.push({ id: 'YESTERDAY-header', kind: 'header', label: 'YESTERDAY' });
    yesterdayItems.forEach((a) => listData.push({ ...a, kind: 'alert' }));
  }
  if (earlierItems.length) {
    listData.push({ id: 'EARLIER-header', kind: 'earlierHeader', label: 'EARLIER', count: earlierItems.length });
    if (earlierExpanded) {
      earlierItems.forEach((a) => listData.push({ ...a, kind: 'alert' }));
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'right', 'left']}>
      <AlertsHeader onBack={() => router.back()} />
      <FilterTabs selected={filter} onSelect={setFilter} />

      <FlatList
        data={listData}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: { item: any }) => {
          if (item.kind === 'header') {
            return <SectionHeader title={item.label} />;
          }
          if (item.kind === 'earlierHeader') {
            return (
              <CollapsibleSectionHeader
                title={item.label}
                count={item.count}
                expanded={earlierExpanded}
                onToggle={handleToggleEarlier}
              />
            );
          }

          return <AlertCard alert={item} onPress={() => setSelectedAlert(item)} />;
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={32} color="#C4CBD2" />
            <Text style={styles.emptyText}>No alerts right now</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00853E"
            colors={['#00853E']}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* commuters submit hazard reports for admin review */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/report-options')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={!!selectedAlert}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedAlert(null)}
      >
        {/* RN's Modal mounts into its own native root on iOS, so the outer
            SafeAreaProvider's measured insets don't reach inside it — without
            this, SafeAreaView here sees a 0 top inset and the header renders
            up under the notch/status bar, out of easy tap reach. */}
        <SafeAreaProvider>
          {selectedAlert && (
            <AlertDetail alert={selectedAlert} onBack={() => setSelectedAlert(null)} />
          )}
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lotRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  lotText: { fontSize: 12.5, fontWeight: '700', color: '#00853E' },
  screen: {
    flex: 1,
    backgroundColor: '#f9f9f9', // matches the app's overall background
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#00853E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },

  // page header: back button + centered title, matching the Lot Details modal header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerSpacer: {
    width: 47,
  },

  // full-width segmented control, track styled like the Lots screen's search bar
  filterHeader: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#f2f4f3',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  filterBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  filterBtnActive: {
    backgroundColor: '#00853E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 1,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterBtnTextActive: {
    color: '#fff',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 6,
    marginBottom: 10,
    marginLeft: 2,
  },
  collapsibleSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsibleCount: {
    color: '#C4CBD5',
    fontWeight: '600',
    letterSpacing: 0,
    textTransform: 'none',
  },

  card: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 21,
    marginBottom: 4,
  },
  cardTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  cardThumbWrap: {
    position: 'relative',
    marginLeft: 10,
    marginTop: 2,
  },
  cardThumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  cardThumbBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cardThumbBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '94%',
    height: '80%',
  },

  // detail view
  detailContent: {
    padding: 20,
    paddingBottom: 40,
  },
  detailIconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  detailIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 12,
    marginRight: 14,
    marginTop: 2,
  },
  detailTitleWrap: {
    flex: 1,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 26,
  },
  detailTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  detailEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  detailCategoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  detailCategoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  detailInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailInfoRowLast: {
    borderBottomWidth: 0,
  },
  detailInfoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  detailInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  detailSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 15,
    lineHeight: 23,
    color: '#475569',
    marginBottom: 20,
  },
  detailPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailPhoto: {
    width: 104,
    height: 104,
    borderRadius: 10,
    backgroundColor: '#E5E7EB',
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 48,
    gap: 6,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#C4CBD2',
  },
});