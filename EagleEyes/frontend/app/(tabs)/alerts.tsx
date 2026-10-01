import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  Modal,
} from 'react-native';
import { getAlerts, BASE_URL } from '../../api/alerts';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type AlertType = 'warning' | 'info' | 'event';
type FilterType = 'All' | 'Unread' | 'Important';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  time: string;
  section: 'Today' | 'Yesterday' | 'Earlier';
  type: AlertType;
  lotName?: string;
  imageUrls?: string[];
  unread?: boolean;
  important?: boolean;
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
    section: sectionFor(raw.created_at),
    type: raw.alert_type === 'hazard' ? 'warning' : raw.alert_type === 'event' ? 'event' : 'info',
    lotName: raw.lot_name || undefined,
    imageUrls: Array.isArray(raw.image_urls) && raw.image_urls.length ? raw.image_urls : undefined,
    unread: sectionFor(raw.created_at) === 'Today',
    important: raw.alert_type === 'hazard' || (raw.upvotes ?? 0) >= 2,
  };
}


const TYPE_STYLES = {
  warning: {
    bg: '#FDECC8',
    icon: 'warning-outline' as const,
    color: '#D89B1D',
  },
  info: {
    bg: '#DBEAFE',
    icon: 'information-circle-outline' as const,
    color: '#3B82F6',
  },
  event: {
    bg: '#DCFCE7',
    icon: 'megaphone-outline' as const,
    color: '#8B5A3C',
  },
};

// function TopBar() {
//   const router = useRouter();

//   return (
//     <View style={styles.topBar}>
//       <View style={styles.topBarSide}>
//         <Image
//           source={require('../../assets/images/Logo_EagleEye.png')}
//           style={styles.logo}
//         />
//       </View>

//       <Text style={styles.appName}>EagleEyes</Text>

//       <View style={styles.topBarSide}>
//         <TouchableOpacity
//           style={styles.bellWrapper}
//           onPress={() => router.push('/(tabs)/alerts')}
//         >
//           <Ionicons name="notifications-outline" size={27} color="#333" />
//         </TouchableOpacity>
//       </View>
//     </View>
//   );
// }

function AlertsHeader() {
  return (
    <View style={styles.headerCard}>
      <Text style={styles.headerTitle}>Alerts</Text>
      <Text style={styles.headerSubtitle}>
        Parking notices, permit updates, and campus events
      </Text>
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
  const tabs: FilterType[] = ['All', 'Unread', 'Important'];

  return (
    <View style={styles.tabsWrapper}>
      <View style={styles.tabsRow}>
        {tabs.map((tab) => {
          const active = selected === tab;

          return (
            <TouchableOpacity
              key={tab}
              style={styles.tabButton}
              onPress={() => onSelect(tab)}
            >
              <Text style={[styles.tabText, active && styles.activeTabText]}>
                {tab}
              </Text>
              {active && <View style={styles.activeUnderline} />}
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

function AlertCard({ alert }: { alert: AlertItem }) {
  const visual = TYPE_STYLES[alert.type];
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon} size={27} color={visual.color} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{alert.title}</Text>
          <Text style={styles.cardTime}>{alert.time}</Text>
        </View>

        {!!alert.lotName && (
          <View style={styles.lotRow}>
            <Ionicons name="location" size={13} color="#00853E" />
            <Text style={styles.lotText}>{alert.lotName}</Text>
          </View>
        )}
        <Text style={styles.cardDescription}>{alert.description}</Text>

        {!!alert.imageUrls?.length && (
          <View style={styles.cardPhotoRow}>
            {alert.imageUrls.map((url) => (
              <TouchableOpacity key={url} onPress={() => setPreviewUri(`${BASE_URL}${url}`)} activeOpacity={0.85}>
                <Image source={{ uri: `${BASE_URL}${url}` }} style={styles.cardPhoto} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <TouchableOpacity
          style={styles.previewOverlay}
          activeOpacity={1}
          onPress={() => setPreviewUri(null)}
        >
          {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

export default function AlertsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>('All');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
      case 'Unread':
        return alerts.filter((alert) => alert.unread);
      case 'Important':
        return alerts.filter((alert) => alert.important);
      default:
        return alerts;
    }
  }, [filter, alerts]);

  const sections: { label: string; items: AlertItem[] }[] = [
    { label: 'TODAY', items: filteredAlerts.filter((a) => a.section === 'Today') },
    { label: 'YESTERDAY', items: filteredAlerts.filter((a) => a.section === 'Yesterday') },
    { label: 'EARLIER', items: filteredAlerts.filter((a) => a.section === 'Earlier') },
  ];

  const listData = sections.flatMap((s) =>
    s.items.length
      ? [
          { id: `${s.label}-header`, kind: 'header' as const, label: s.label },
          ...s.items.map((a) => ({ ...a, kind: 'alert' as const })),
        ]
      : []
  );

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      {/* <TopBar /> */}

      <FlatList
        data={listData}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }: { item: any }) => {
          if (item.kind === 'header') {
            return <SectionHeader title={item.label} />;
          }

          return <AlertCard alert={item} />;
        }}
        ListHeaderComponent={
          <>
            <AlertsHeader />
            <FilterTabs selected={filter} onSelect={setFilter} />
          </>
        }
        ListEmptyComponent={
          <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 32 }}>
            No alerts right now. Pull down to refresh.
          </Text>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* commuters submit hazard reports for admin review */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/report-options')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Report a hazard"
      >
        <Ionicons name="warning" size={30} color="#FACC15" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  lotRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  lotText: { fontSize: 12.5, fontWeight: '700', color: '#00853E' },
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#00853E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },

  // top app bar 
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  topBarSide: {
    width: 50,
    justifyContent: 'center',
  },
  bellWrapper: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 100,
    height: 55,
    resizeMode: 'contain',
  },
  appName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00853E',
  },

  // green branded top card
  headerCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#00853E',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#7C8A96',
    marginTop: 2,
  },

  tabsWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    marginBottom: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 2,
    gap: 24,
  },
  tabButton: {
    paddingTop: 10,
    paddingBottom: 12,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#334155',
  },
  activeUnderline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#16A34A',
  },

  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.7,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 2,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 21,
  },
  cardTime: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 2,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 21,
    color: '#64748B',
  },
  cardPhotoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cardPhoto: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
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
});