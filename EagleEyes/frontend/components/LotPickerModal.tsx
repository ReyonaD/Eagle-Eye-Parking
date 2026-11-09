import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { isLotClosed } from '../utils/lotStatus';
import { formatDistance, LatLng } from '../utils/geo';
import { useLotPickerList, PickerLot, UNT_CENTER } from './lotPickerShared';

//selectedName while the "Not in a lot" row is picked (no real lot is named this)
const NO_LOT = '__no_lot__';

const UNT_REGION = { ...UNT_CENTER, latitudeDelta: 0.018, longitudeDelta: 0.018 };
//how far the map zooms in on a lot picked from the list/search
const FOCUS_DELTA = 0.004;

export default function LotPickerModal({
  visible,
  onClose,
  onSelect,
  disableClosed = false,
  onSelectNoLot,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (lotName: string) => void;
  //when given, a "Not in a lot" choice is offered (e.g. a hazard on the road
  //between lots) and picking it calls this instead of onSelect
  onSelectNoLot?: () => void;
  //true = lots closed right now can't be picked (e.g. hazard reports). Closed
  //lots are always tagged "CLOSED" either way.
  disableClosed?: boolean;
}) {
  //SafeAreaView is unreliable inside a Modal, so apply the insets manually
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [ownFix, setOwnFix] = useState<LatLng | null>(null);
  const { polygons, nearest, matches, hasLocation } = useLotPickerList(visible, query, ownFix);
  const searching = query.trim().length > 0;

  //pick a lot from the list or search: select it and show where it is
  const pickFromList = (lot: PickerLot) => {
    setSelectedName(lot.name);
    setQuery('');
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({ ...lot.center, latitudeDelta: FOCUS_DELTA, longitudeDelta: FOCUS_DELTA }, 400);
  };

  const close = () => {
    setQuery('');
    onClose();
  };

  const confirm = () => {
    if (selectedName === NO_LOT) {
      onSelectNoLot?.();
      close();
    } else if (selectedName) {
      onSelect(selectedName);
      close();
    }
  };

  const pickNoLot = () => {
    setSelectedName(NO_LOT);
    setQuery('');
  };

  //the "Not in a lot" row: atop the nearest list, and offered again when a
  //search finds nothing
  const noLotRow = onSelectNoLot ? (
    <TouchableOpacity
      style={[styles.row, styles.noLotRow, selectedName === NO_LOT && styles.rowSelected]}
      onPress={pickNoLot}
    >
      <Ionicons name="navigate-circle-outline" size={20} color="#3976B9" />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowName, selectedName === NO_LOT && styles.rowNameSelected]}>Not in a lot</Text>
        <Text style={styles.noLotHint}>Road, sidewalk, garage entrance - then describe where</Text>
      </View>
      {selectedName === NO_LOT && <Ionicons name="checkmark-circle" size={20} color="#00853E" />}
    </TouchableOpacity>
  ) : null;

  const renderRow = ({ item }: { item: PickerLot }) => {
    const isSelected = item.name === selectedName;
    const blocked = disableClosed && item.closed;
    return (
      <TouchableOpacity
        style={[styles.row, isSelected && styles.rowSelected, blocked && styles.rowDisabled]}
        onPress={() => pickFromList(item)}
        disabled={blocked}
      >
        <View style={[styles.dot, { backgroundColor: item.fillColor }]} />
        <Text style={[styles.rowName, isSelected && styles.rowNameSelected]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.closed && <Text style={styles.closedTag}>CLOSED</Text>}
        <Text style={styles.rowDistance}>{formatDistance(item.distance)}</Text>
        {isSelected && <Ionicons name="checkmark-circle" size={20} color="#00853E" />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.container, { paddingTop: insets.top + 4, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.headerBtn}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select a Lot</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#888" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Type a lot (e.g. 20, Union Circle)"
            placeholderTextColor="#999"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              //Enter picks the best match, unless it's a closed lot this form can't use
              const best = matches[0];
              if (best && !(disableClosed && best.closed)) pickFromList(best);
            }}
          />
          {searching && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#aaa" />
            </TouchableOpacity>
          )}
        </View>

        {/* hidden (not unmounted) while searching so the map keeps its position */}
        <View style={searching ? styles.hidden : styles.map}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_GOOGLE}
            initialRegion={UNT_REGION}
            showsUserLocation
            onUserLocationChange={(e) => {
              const c = e.nativeEvent.coordinate;
              if (c && !ownFix) setOwnFix({ latitude: c.latitude, longitude: c.longitude });
            }}
          >
            {polygons.map((lot: any) => {
              const isSelected = lot.name === selectedName;
              const blocked = disableClosed && isLotClosed(lot.lotStatus);
              return (
                <Polygon
                  key={lot.id}
                  coordinates={lot.coordinates}
                  fillColor={isSelected ? 'rgba(0,133,62,0.55)' : lot.fillColor}
                  strokeColor={isSelected ? '#00853E' : lot.strokeColor}
                  strokeWidth={isSelected ? 3 : 2}
                  tappable={!blocked}
                  onPress={() => { if (!blocked) setSelectedName(lot.name); }}
                />
              );
            })}
          </MapView>
        </View>

        <Text style={styles.sectionLabel}>
          {searching
            ? (matches.length ? `${matches.length} MATCHING LOT${matches.length === 1 ? '' : 'S'}` : `NO LOTS MATCH "${query.trim().toUpperCase()}"`)
            : hasLocation ? 'NEAREST TO YOU' : 'NEAREST TO CAMPUS CENTER'}
        </Text>

        <FlatList
          style={styles.list}
          data={searching ? matches : nearest}
          keyExtractor={(item) => item.name}
          renderItem={renderRow}
          ListHeaderComponent={searching ? null : noLotRow}
          ListEmptyComponent={searching ? noLotRow : null}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />

        {!searching && (
          <TouchableOpacity
            style={[styles.confirmBtn, !selectedName && styles.confirmBtnDisabled]}
            onPress={confirm}
            disabled={!selectedName}
          >
            <Text style={styles.confirmText}>
              {selectedName === NO_LOT
                ? 'CONTINUE WITHOUT A LOT'
                : selectedName ? `SELECT ${selectedName.toUpperCase()}` : 'SELECT A LOT'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingTop: 4,
  },
  headerBtn: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#00853E' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 12, marginTop: 8, marginBottom: 10,
    paddingHorizontal: 12, height: 44,
    backgroundColor: '#f2f2f2', borderRadius: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1a1a1a', paddingVertical: 0 },

  map: { height: '40%' },
  hidden: { height: 0, overflow: 'hidden' },

  sectionLabel: {
    fontSize: 11, fontWeight: '900', color: '#888', letterSpacing: 1.2,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
  },
  list: { flex: 1, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  rowSelected: { backgroundColor: '#E8F5EE' },
  rowDisabled: { opacity: 0.45 },
  noLotRow: { backgroundColor: '#F5F9FD' },
  noLotHint: { fontSize: 12, color: '#888', marginTop: 2 },
  closedTag: {
    fontSize: 10, fontWeight: '800', color: '#fff', backgroundColor: '#374151',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
  rowNameSelected: { color: '#00853E' },
  rowDistance: { fontSize: 13, color: '#888', fontVariant: ['tabular-nums'] },

  confirmBtn: {
    backgroundColor: '#00853E', margin: 12, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#b5cfc0' },
  confirmText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
});
