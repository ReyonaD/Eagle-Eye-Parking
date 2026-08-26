import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLots } from '../../context/LotsContext';
import { openDirections } from '../../utils/navigation';
type AvailabilityStatus = 'Available' | 'Near Capacity' | 'Full';

const STATUS_COLOR: Record<AvailabilityStatus, string> = {
  'Available': '#00853E',
  'Near Capacity': '#F5A623',
  'Full': '#D0021B',
};

const PERMIT_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  'A':    { bg: '#D4C8A8', text: '#5C4A1E' },
  'B':    { bg: '#B8CBE8', text: '#1E3A6A' },
  'C':    { bg: '#B8E0C8', text: '#1A5C30' },
  'E':    { bg: '#EEE0A0', text: '#7A6200' },
  'F/S':  { bg: '#B4C4DA', text: '#1E3A5F' },
  'G':    { bg: '#E0B8D0', text: '#5F1E4A' },
  'T':    { bg: '#E0D0B4', text: '#5F3A1E' },
  'PP':   { bg: '#F5E6C8', text: '#8B5E00' },
  'A37':  { bg: '#D4C8A8', text: '#5C4A1E' },
  'MC':   { bg: '#D8D8D8', text: '#444' },
  'SV':   { bg: '#C8D8C8', text: '#1A4A1A' },
  'VIS':  { bg: '#E8D0C8', text: '#6A2A1A' },
};

const PERMIT_ABBREVIATIONS: Record<string, string> = {
  'Premium Parking': 'PP',
  'Motorcycle':      'MC',
  'Faculty/Staff':   'F/S',
  'Visitor':         'VIS',
  'General':         'GEN',
  'Economy':         'E',
  'Student':         'STU',
  'Service Vehicle': 'SV',
};

function abbreviatePermit(permit: string): string {
  if (PERMIT_ABBREVIATIONS[permit]) return PERMIT_ABBREVIATIONS[permit];
  // Strip parenthetical suffix: "PP(Visitor)" → "PP", "Premium Parking (V)" → "Premium Parking"
  const stripped = permit.replace(/\s*\(.*$/, '').trim();
  if (stripped && PERMIT_ABBREVIATIONS[stripped]) return PERMIT_ABBREVIATIONS[stripped];
  const base = stripped || permit;
  if (base.length <= 4) return base;
  const words = base.split(/[\s/]+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join('').toUpperCase().slice(0, 4);
  return base.slice(0, 3).toUpperCase();
}

function getPermitBadgeInfo(permitList: string[], lotName?: string) {
  if (!permitList || permitList.length === 0) {
    // Try to extract a hint from the lot name (e.g. "Lot 13 - SV" → "SV")
    const namePart = lotName?.match(/[-–]\s*([A-Z0-9/]{1,6})\s*$/i)?.[1]?.toUpperCase();
    if (namePart) {
      const colors = PERMIT_BADGE_COLORS[namePart] || { bg: '#D8D8D8', text: '#555' };
      return { label: namePart, ...colors };
    }
    return { label: '?', bg: '#E0E0E0', text: '#666' };
  }
  const raw = permitList[0].trim();
  const label = abbreviatePermit(raw);
  const colors = PERMIT_BADGE_COLORS[label] || PERMIT_BADGE_COLORS[raw] || { bg: '#D8D8D8', text: '#555' };
  return { label, ...colors };
}

function LotCard({ lot, onPress }: { lot: any; onPress: (lot: any) => void }) {
  const dotColor = STATUS_COLOR[lot.status as AvailabilityStatus] || STATUS_COLOR['Available'];
  const badge = getPermitBadgeInfo(lot.permitList || [], lot.name);
  const displayPercent = typeof lot.percentEmpty === 'number' ? `${lot.percentEmpty}% Empty` : 'Live';

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(lot)} activeOpacity={0.7}>
      <View style={[styles.permitBadge, { backgroundColor: badge.bg }]}>
        <Text
          style={[styles.permitBadgeText, { color: badge.text }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {badge.label}
        </Text>
      </View>
      <View style={styles.cardMiddle}>
        <Text style={styles.lotName}>{lot.name}</Text>
        <Text style={[styles.percentText, { color: dotColor }]}>{displayPercent}</Text>
      </View>
      <View style={styles.cardRight}>
        <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.statusText, { color: dotColor }]}>{lot.status}</Text>
      </View>
    </TouchableOpacity>
  );
}

function FilterHeader({
  query,
  onChangeQuery,
  permitFilter,
  availabilityFilter,
  onAllPermits,
  onPermitPress,
  onAvailabilityPress,
}: {
  query: string;
  onChangeQuery: (text: string) => void;
  permitFilter: string;
  availabilityFilter: string;
  onAllPermits: () => void;
  onPermitPress: () => void;
  onAvailabilityPress: () => void;
}) {
  const allActive = permitFilter === 'all' && availabilityFilter === 'all';
  const permitActive = permitFilter !== 'all';
  const availabilityActive = availabilityFilter !== 'all';

  return (
    <View style={styles.filterHeader}>
      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search-outline" size={27} color="#aaa" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Lot Search"
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={onChangeQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => onChangeQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={27} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Buttons */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, allActive && styles.filterBtnActive]}
          onPress={onAllPermits}
        >
          <Text style={[styles.filterBtnText, allActive && styles.filterBtnTextActive]}>
            ALL PERMITS
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, permitActive && styles.filterBtnActive]}
          onPress={onPermitPress}
        >
          <Text style={[styles.filterBtnText, permitActive && styles.filterBtnTextActive]}>
            {permitFilter !== 'all' ? permitFilter : 'PERMIT'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={permitActive ? '#fff' : '#555'}
            style={{ marginLeft: 3 }}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterBtn, availabilityActive && styles.filterBtnActive]}
          onPress={onAvailabilityPress}
        >
          <Text style={[styles.filterBtnText, availabilityActive && styles.filterBtnTextActive]}>
            {availabilityFilter !== 'all' ? availabilityFilter.toUpperCase() : 'AVAILABILITY'}
          </Text>
          <Ionicons
            name="chevron-down"
            size={12}
            color={availabilityActive ? '#fff' : '#555'}
            style={{ marginLeft: 3 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LotsScreen() {
  const [query, setQuery] = useState('');
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [moreInfoVisible, setMoreInfoVisible] = useState(false);
  const [permitFilter, setPermitFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState('all');
  const [permitPickerVisible, setPermitPickerVisible] = useState(false);
  const [availabilityPickerVisible, setAvailabilityPickerVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { lots, isLoading, lastRefreshAt } = useLots();

  const refreshLabel = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Waiting for sync';

  const uniquePermits = useMemo(() => {
    const set = new Set<string>();
    lots.forEach((lot) => {
      (lot.permitList || []).forEach((p: string) => set.add(p.trim()));
    });
    return Array.from(set).sort();
  }, [lots]);

  const filtered = useMemo(() => {
    return lots.filter((lot) => {
      const q = query.toLowerCase();
      const nameMatch = (lot.name?.toLowerCase() || '').includes(q);
      const permitMatch = (lot.permits?.toLowerCase() || '').includes(q);
      if (!nameMatch && !permitMatch) return false;
      if (permitFilter !== 'all') {
        const hasPermit = (lot.permitList || []).some(
          (p: string) => p.trim() === permitFilter
        );
        if (!hasPermit) return false;
      }
      if (availabilityFilter !== 'all' && lot.status !== availabilityFilter) return false;
      return true;
    });
  }, [lots, query, permitFilter, availabilityFilter]);

  const handleLotPress = (lot: any) => {
    try {
      setSelectedLot(lot);
      setModalVisible(true);
    } catch (error) {
      console.error('Error opening lot details:', error);
      Alert.alert('Error', 'Failed to open lot details. Please try again.');
    }
  };

  const closeModal = () => {
    setMoreInfoVisible(false);
    setModalVisible(false);
    setSelectedLot(null);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#00853E" />
        <Text style={{ marginTop: 12, color: '#666', fontSize: 16 }}>Loading Parking Data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['right', 'left']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LotCard lot={item} onPress={handleLotPress} />}
        ListHeaderComponent={
          <>
            <View style={styles.liveStatusBar}>
              <Ionicons name="time-outline" size={14} color="#5d6d7e" />
              <Text style={styles.liveStatusText}>Last synced: {refreshLabel}</Text>
            </View>
            <FilterHeader
              query={query}
              onChangeQuery={setQuery}
              permitFilter={permitFilter}
              availabilityFilter={availabilityFilter}
              onAllPermits={() => { setPermitFilter('all'); setAvailabilityFilter('all'); }}
              onPermitPress={() => setPermitPickerVisible(true)}
              onAvailabilityPress={() => setAvailabilityPickerVisible(true)}
            />
          </>
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No lots match your search.</Text>
        }
        keyboardShouldPersistTaps="handled"
      />

      {/* Permit Picker Modal */}
      <Modal transparent animationType="fade" visible={permitPickerVisible} onRequestClose={() => setPermitPickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPermitPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Filter by Permit</Text>
            <TouchableOpacity style={styles.pickerOption} onPress={() => { setPermitFilter('all'); setPermitPickerVisible(false); }}>
              <Text style={[styles.pickerOptionText, permitFilter === 'all' && styles.pickerOptionActive]}>All Permits</Text>
              {permitFilter === 'all' && <Ionicons name="checkmark" size={27} color="#00853E" />}
            </TouchableOpacity>
            {uniquePermits.map((p) => (
              <TouchableOpacity key={p} style={styles.pickerOption} onPress={() => { setPermitFilter(p); setPermitPickerVisible(false); }}>
                <Text style={[styles.pickerOptionText, permitFilter === p && styles.pickerOptionActive]}>{p}</Text>
                {permitFilter === p && <Ionicons name="checkmark" size={27} color="#00853E" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Availability Picker Modal */}
      <Modal transparent animationType="fade" visible={availabilityPickerVisible} onRequestClose={() => setAvailabilityPickerVisible(false)}>
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setAvailabilityPickerVisible(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Filter by Availability</Text>
            {(['all', 'Available', 'Near Capacity', 'Full'] as const).map((opt) => (
              <TouchableOpacity key={opt} style={styles.pickerOption} onPress={() => { setAvailabilityFilter(opt); setAvailabilityPickerVisible(false); }}>
                <Text style={[styles.pickerOptionText, availabilityFilter === opt && styles.pickerOptionActive]}>
                  {opt === 'all' ? 'All' : opt}
                </Text>
                {availabilityFilter === opt && <Ionicons name="checkmark" size={27} color="#00853E" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Lot Details Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
            <TouchableOpacity onPress={closeModal} style={{ padding: 10 }}>
              <Ionicons name="chevron-back" size={27} color="#00853E" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Lot Details</Text>
            <View style={{ width: 48 }} />
          </View>

          {selectedLot ? (
            <ScrollView style={styles.modalContent}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLotName}>{selectedLot.name}</Text>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status:</Text>
                  <View style={[
                    styles.statusBadgeDetail,
                    { backgroundColor: (STATUS_COLOR[selectedLot.status as AvailabilityStatus] || STATUS_COLOR['Available']) + '1A' }
                  ]}>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLOR[selectedLot.status as AvailabilityStatus] || STATUS_COLOR['Available'] }
                    ]} />
                    <Text style={[
                      styles.statusText,
                      { color: STATUS_COLOR[selectedLot.status as AvailabilityStatus] || STATUS_COLOR['Available'] }
                    ]}>
                      {selectedLot.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Available Spaces:</Text>
                  <Text style={styles.detailValue}>
                    {typeof selectedLot.percentEmpty === 'number' ? `${selectedLot.percentEmpty}%` : 'Unknown'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>ParkZen capture time:</Text>
                  <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
                    {selectedLot.sourceTimestampProvidedByParkzen === true && selectedLot.lastUpdatedAt
                      ? new Date(selectedLot.lastUpdatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                      : 'No time available'}
                  </Text>
                </View>
              </View>

              <TouchableOpacity style={styles.actionButton} onPress={() => openDirections(selectedLot)}>
                <Ionicons name="navigate" size={27} color="#fff" />
                <Text style={styles.actionButtonText}>Get Directions</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: '#f0f0f0', marginTop: 12 }]}
                onPress={() => setMoreInfoVisible(!moreInfoVisible)}
              >
                <Ionicons name={moreInfoVisible ? "chevron-up-circle-outline" : "information-circle-outline"} size={27} color="#00853E" />
                <Text style={[styles.actionButtonText, { color: '#00853E' }]}>More Info</Text>
              </TouchableOpacity>

              {moreInfoVisible && (
                <View style={[styles.detailCard, { marginTop: 12 }]}>
                  {selectedLot.address ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Address:</Text>
                      <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]} numberOfLines={2}>{selectedLot.address}</Text>
                    </View>
                  ) : null}
                  {selectedLot.capacity ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Capacity:</Text>
                      <Text style={styles.detailValue}>{selectedLot.capacity} spaces</Text>
                    </View>
                  ) : null}
                  {(selectedLot.permitList || []).length > 0 && (
                    <View style={{ marginTop: 6 }}>
                      <Text style={styles.detailLabel}>Permits:</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {selectedLot.permitList.map((p: string, i: number) => (
                          <View key={i} style={{ backgroundColor: '#f0f0f0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 12, color: '#555', fontWeight: '500' }}>{p.trim()}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },

  liveStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  liveStatusText: {
    fontSize: 12,
    color: '#5d6d7e',
    fontWeight: '500',
  },

  // --- FILTER HEADER ---
  filterHeader: {
    backgroundColor: '#fff',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', 
    marginBottom: 8,
    // Added elevation to match the Map Screen's floating effect
    zIndex: 10,
    elevation: 4, 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    backgroundColor: '#f2f4f3',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#222',
  },
  clearButton: {
    padding: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e0e0e0', // Slightly lighter border for inactive pills
    backgroundColor: '#fff',
  },
  filterBtnActive: {
    backgroundColor: '#00853E',
    borderColor: '#00853E',
  },
  filterBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555',
    letterSpacing: 0.3,
  },
  filterBtnTextActive: {
    color: '#fff',
  },

  // --- LIST CONTENT ---
  listContent: {
    paddingHorizontal: 16, // Matched Map Screen horizontal padding
    paddingBottom: 24,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#999',
    fontSize: 15,
  },

  // --- LOT CARD ---
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, // Slightly more pronounced shadow
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  permitBadge: {
    width: 46,
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permitBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardMiddle: {
    flex: 1,
    gap: 3,
  },
  lotName: {
    fontSize: 16,
    fontWeight: '700', // Made slightly bolder
    color: '#1a1a1a',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardRight: {
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 70,
  },

  // --- PICKER MODAL ---
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, // Slightly rounder top edges
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40, // Extra bottom padding for newer iPhones
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 14,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  pickerOptionActive: {
    color: '#00853E',
    fontWeight: '700',
  },

  // --- LOT DETAILS MODAL ---
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9f9f9', // Matched to overall app background
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', // Matched borders
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  detailLotName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#00853E',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statusBadgeDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  actionButton: {
    backgroundColor: '#00853E',
    borderRadius: 12, // Slightly rounder buttons
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});