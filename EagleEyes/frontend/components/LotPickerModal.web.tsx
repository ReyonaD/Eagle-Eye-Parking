import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { useLots } from '../context/LotsContext';

//same tappable-polygon pattern as EagleMap.web.tsx's WebPolygon
function TappablePolygon({ paths, options, onClick }: { paths: any; options: any; onClick?: () => void }) {
  const map = useMap();
  const polygonRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !(window as any).google) return;
    if (!polygonRef.current) {
      polygonRef.current = new (window as any).google.maps.Polygon();
    }
    polygonRef.current.setMap(map);
    const listener = polygonRef.current.addListener('click', onClick);
    return () => {
      listener.remove();
      polygonRef.current?.setMap(null);
    };
  }, [map, onClick]);

  useEffect(() => {
    if (!polygonRef.current) return;
    polygonRef.current.setOptions({ ...options, paths });
  }, [paths, options]);

  return null;
}

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

//react-native-maps is native-only and can't be bundled for web (Metro/Expo Router
//picks this file over LotPickerModal.tsx automatically on web), so this variant
//swaps it for @vis.gl/react-google-maps, same as EagleMap.web.tsx.
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
  const insets = useSafeAreaInsets();
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const [selectedName, setSelectedName] = useState<string | null>(null);
  //falls back to campus center until (if) the browser reports the user's position
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!visible || typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLoc({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => {}, // permission denied or unavailable — just keep the campus-center fallback
      { timeout: 5000 },
    );
  }, [visible]);

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

        {apiKey ? (
          <View style={styles.map}>
            <APIProvider apiKey={apiKey}>
              <Map
                defaultCenter={{ lat: UNT_REGION.latitude, lng: UNT_REGION.longitude }}
                defaultZoom={15}
                gestureHandling="greedy"
                disableDefaultUI
                style={{ width: '100%', height: '100%' }}
              >
                {sortedLots.map((lot: any) => {
                  const isSelected = lot.name === selectedName;
                  return (
                    <TappablePolygon
                      key={lot.id}
                      paths={lot.coordinates.map((c: any) => ({ lat: c.latitude, lng: c.longitude }))}
                      options={{
                        fillColor: isSelected ? 'rgba(0,133,62,0.55)' : lot.fillColor,
                        strokeColor: isSelected ? '#00853E' : lot.strokeColor,
                        strokeWeight: isSelected ? 3 : 2,
                        clickable: true,
                      }}
                      onClick={() => setSelectedName(lot.name)}
                    />
                  );
                })}
              </Map>
            </APIProvider>
          </View>
        ) : (
          <View style={[styles.map, styles.mapPlaceholder]}>
            <Text style={styles.mapPlaceholderText}>Google Maps API key is missing</Text>
          </View>
        )}

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
  mapPlaceholder: { backgroundColor: '#eaeaea', justifyContent: 'center', alignItems: 'center' },
  mapPlaceholderText: { fontSize: 13, color: '#d32f2f', fontWeight: '600' },

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
