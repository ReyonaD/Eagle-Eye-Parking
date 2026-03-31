import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type AvailabilityStatus = 'Available' | 'Near Capacity' | 'Full';

interface ParkingLot {
  id: string;
  name: string;
  permitType: string;
  status: AvailabilityStatus;
  percentEmpty: number; // 0–100
}

// TODO: Replace with real API call (e.g., fetch from ParkZen / AIMS).
const DUMMY_LOTS: ParkingLot[] = [
  { id: '1', name: 'Lot 20', permitType: 'E', status: 'Available', percentEmpty: 85 },
  { id: '2', name: 'Lot 11', permitType: 'F/S', status: 'Near Capacity', percentEmpty: 28 },
  { id: '3', name: 'Lot 1', permitType: 'A', status: 'Full', percentEmpty: 0 },
  { id: '4', name: 'Lot 5', permitType: 'F/S', status: 'Available', percentEmpty: 62 },
  { id: '5', name: 'Lot 7', permitType: 'E', status: 'Near Capacity', percentEmpty: 35 },
  { id: '6', name: 'Lot 14', permitType: 'A', status: 'Available', percentEmpty: 91 },
  { id: '7', name: 'Lot 3', permitType: 'F/S', status: 'Full', percentEmpty: 0 },
  { id: '8', name: 'Lot 22', permitType: 'E', status: 'Available', percentEmpty: 74 },
];

const STATUS_COLOR: Record<AvailabilityStatus, string> = {
  'Available': '#00853E',
  'Near Capacity': '#F5A623',
  'Full': '#D0021B',
};

function TopBar() {
  return (
    <View style={styles.topBar}>
      <View style={styles.topBarSide}>
        <Image
          source={require('../../assets/images/Logo_EagleEye.png')}
          style={styles.logo}
        />
      </View>
      <Text style={styles.appName}>EagleEyes</Text>
      <View style={styles.topBarSide}>
        <TouchableOpacity style={styles.bellWrapper}>
          <Ionicons name="notifications-outline" size={28} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LotCard({ lot }: { lot: ParkingLot }) {
  const dotColor = STATUS_COLOR[lot.status];

  return (
    <View style={styles.card}>
      <View style={styles.cardLeft}>
        <Text style={styles.lotName}>{lot.name}</Text>
        <Text style={styles.permitLabel}>Permit: {lot.permitType}</Text>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.statusBadge, { backgroundColor: dotColor + '1A' }]}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={[styles.statusText, { color: dotColor }]}>{lot.status}</Text>
        </View>
        {lot.percentEmpty > 0 && (
          <Text style={styles.percentText}>{lot.percentEmpty}% open</Text>
        )}
      </View>
    </View>
  );
}

function ListHeader({ query, onChangeQuery }: { query: string; onChangeQuery: (text: string) => void }) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parking Lots</Text>
        <Text style={styles.headerSubtitle}>UNT Campus · Live Availability</Text>
      </View>
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Lot Search (e.g. Lot 20, E, F/S)"
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={onChangeQuery}
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>
      <View style={styles.legend}>
        {(Object.keys(STATUS_COLOR) as AvailabilityStatus[]).map((status) => (
          <View key={status} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_COLOR[status] }]} />
            <Text style={styles.legendLabel}>{status}</Text>
          </View>
        ))}
      </View>
    </>
  );
}

export default function LotsScreen() {
  const [query, setQuery] = useState('');

  const filtered = DUMMY_LOTS.filter((lot) => {
    const q = query.toLowerCase();
    return (
      lot.name.toLowerCase().includes(q) ||
      lot.permitType.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.screen}>
      <TopBar />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LotCard lot={item} />}
        ListHeaderComponent={<ListHeader query={query} onChangeQuery={setQuery} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No lots match your search.</Text>
        }
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },

  // Top Bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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

  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#00853E',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },

  // Search
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  searchInput: {
    height: 44,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#222',
  },

  // Legend
  legend: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
    marginBottom: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    color: '#555',
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
    fontSize: 15,
  },

  // Card
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardLeft: {
    gap: 4,
  },
  lotName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  permitLabel: {
    fontSize: 13,
    color: '#777',
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  percentText: {
    fontSize: 12,
    color: '#999',
  },
});
