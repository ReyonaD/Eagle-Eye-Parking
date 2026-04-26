import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
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
  section: 'Today' | 'Yesterday';
  type: AlertType;
  unread?: boolean;
  important?: boolean;
}

const ALERTS: AlertItem[] = [
  {
    id: '1',
    title: 'Lot 7 Closed for Construction',
    description:
      'Lot 7 will be fully closed starting Oct 15th for resurfacing. Please use the other lots as an alternative.',
    time: '2h',
    section: 'Today',
    type: 'warning',
    unread: true,
    important: true,
  },
  {
    id: '2',
    title: 'Commuter Permit Updates',
    description:
      'Eagle Annual permit applications are now open. Renew before Sep 1st to secure your spot.',
    time: '5h',
    section: 'Today',
    type: 'info',
    unread: true,
    important: false,
  },
  {
    id: '3',
    title: 'Game Day Parking Enforcement',
    description:
      'Lot 20 will be reserved for game parking today starting at 12:00 PM. Ensure your car is parked appropriately.',
    time: '1d',
    section: 'Yesterday',
    type: 'event',
    unread: false,
    important: true,
  },
  {
    id: '4',
    title: 'Lot 25 Temporarily Closed for Icy Condition',
    description:
      'Lot 25 is temporarily closed due to icy conditions. Please avoid the area until further notice.',
    time: '1d',
    section: 'Yesterday',
    type: 'info',
    unread: false,
    important: false,
  },
];

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
//           <Ionicons name="notifications-outline" size={28} color="#333" />
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

  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon} size={18} color={visual.color} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{alert.title}</Text>
          <Text style={styles.cardTime}>{alert.time}</Text>
        </View>

        <Text style={styles.cardDescription}>{alert.description}</Text>
      </View>
    </View>
  );
}

export default function AlertsScreen() {
  const [filter, setFilter] = useState<FilterType>('All');

  const filteredAlerts = useMemo(() => {
    switch (filter) {
      case 'Unread':
        return ALERTS.filter((alert) => alert.unread);
      case 'Important':
        return ALERTS.filter((alert) => alert.important);
      default:
        return ALERTS;
    }
  }, [filter]);

  const todayAlerts = filteredAlerts.filter((a) => a.section === 'Today');
  const yesterdayAlerts = filteredAlerts.filter((a) => a.section === 'Yesterday');

  const listData = [
    ...(todayAlerts.length
      ? [{ id: 'today-header', kind: 'header', label: 'TODAY' as const }]
      : []),
    ...todayAlerts.map((a) => ({ ...a, kind: 'alert' as const })),
    ...(yesterdayAlerts.length
      ? [{ id: 'yesterday-header', kind: 'header', label: 'YESTERDAY' as const }]
      : []),
    ...yesterdayAlerts.map((a) => ({ ...a, kind: 'alert' as const })),
  ];

  return (
    <SafeAreaView style={styles.screen}>
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
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
});