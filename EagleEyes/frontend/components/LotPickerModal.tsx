import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useLots } from '../context/LotsContext';

const UNT_REGION = {
  latitude: 33.2110,
  longitude: -97.1475,
  latitudeDelta: 0.018,
  longitudeDelta: 0.018,
};

//straight-line distance in meters between two coordinates (haversine)
function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function centroid(coords: { latitude: number; longitude: number }[]) {
  const lat = coords.reduce((s, c) => s + c.latitude, 0) / coords.length;
  const lon = coords.reduce((s, c) => s + c.longitude, 0) / coords.length;
  return { latitude: lat, longitude: lon };
}

function formatDistance(m: number) {
  return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function LotPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (lotName: string) => void;
}) {
  const { lots } = useLots();
  //SafeAreaView is unreliable inside a Modal, so apply the insets manually
  const insets = useSafeAreaInsets();
  const [selectedName, setSelectedName] = useState<string | null>(null);
  //falls back to campus center until the map reports the user's position
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);

  const origin = userLoc ?? { latitude: UNT_REGION.latitude, longitude: UNT_REGION.longitude };

  //nearest lot first; distance is measured to the lot polygon's center
  const sortedLots = useMemo(() => {
    return lots
      .filter((l: any) => Array.isArray(l.coordinates) && l.coordinates.length >= 3)
      .map((l: any) => ({ ...l, __distance: distanceMeters(origin, centroid(l.coordinates)) }))
      .sort((a: any, b: any) => a.__distance - b.__distance);
  }, [lots, origin.latitude, origin.longitude]);

  const confirm = () => {
    if (selectedName) {
      onSelect(selectedName);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top + 4, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="close" size={26} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select a Lot</Text>
          <View style={styles.headerBtn} />
        </View>
        <Text style={styles.headerHint}>
          Tap a lot on the map, or pick from the list below (nearest first)
        </Text>

        <MapView
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={UNT_REGION}
          showsUserLocation
          onUserLocationChange={(e) => {
            const c = e.nativeEvent.coordinate;
            if (c && !userLoc) setUserLoc({ latitude: c.latitude, longitude: c.longitude });
          }}
        >
          {sortedLots.map((lot: any) => {
            const isSelected = lot.name === selectedName;
            return (
              <Polygon
                key={lot.id}
                coordinates={lot.coordinates}
                fillColor={isSelected ? 'rgba(0,133,62,0.55)' : lot.fillColor}
                strokeColor={isSelected ? '#00853E' : lot.strokeColor}
                strokeWidth={isSelected ? 3 : 2}
                tappable
                onPress={() => setSelectedName(lot.name)}
              />
            );
          })}
        </MapView>

        <FlatList
          style={styles.list}
          data={sortedLots}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: { item: any }) => {
            const isSelected = item.name === selectedName;
            return (
              <TouchableOpacity
                style={[styles.row, isSelected && styles.rowSelected]}
                onPress={() => setSelectedName(item.name)}
              >
                <View style={[styles.dot, { backgroundColor: item.fillColor || '#999' }]} />
                <Text style={[styles.rowName, isSelected && styles.rowNameSelected]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowDistance}>{formatDistance(item.__distance)}</Text>
                {isSelected && <Ionicons name="checkmark-circle" size={20} color="#00853E" />}
              </TouchableOpacity>
            );
          }}
        />

        <TouchableOpacity
          style={[styles.confirmBtn, !selectedName && styles.confirmBtnDisabled]}
          onPress={confirm}
          disabled={!selectedName}
        >
          <Text style={styles.confirmText}>
            {selectedName ? `SELECT ${selectedName.toUpperCase()}` : 'SELECT A LOT'}
          </Text>
        </TouchableOpacity>
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
  headerHint: { fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 6, paddingHorizontal: 20 },

  map: { height: '45%' },

  list: { flex: 1, backgroundColor: '#fff' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  rowSelected: { backgroundColor: '#E8F5EE' },
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
