import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import LotDetailsSheet from './LotDetailsSheet';
import { Ionicons } from '@expo/vector-icons';

interface EagleMapProps {
  liveLots: any[];
  selectedCampus?: string;
}

const CAMPUS_REGIONS: Record<string, { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }> = {
  "Main campus":     { latitude: 33.2110, longitude: -97.1475, latitudeDelta: 0.018, longitudeDelta: 0.018 },
  "Discovery Park":  { latitude: 33.2549, longitude: -97.1520, latitudeDelta: 0.018, longitudeDelta: 0.018 },
  "Frisco Landing":  { latitude: 33.1858, longitude: -96.8055, latitudeDelta: 0.018, longitudeDelta: 0.018 },
};

const MAP_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const LOT_FILL_OPACITY = 0.35;
const LOT_LABEL_OFFSETS: Record<string, { latitude: number; longitude: number }> = {
  'Lot 3': { latitude: -0.000108, longitude: 0 },
  'Lot 2': { latitude: -0.000109, longitude: 0 },
  'Lot 5': { latitude: -0.00015, longitude: 0 },
  'Lot 19': { latitude: -0.0001, longitude: 0 },
  'Lot 20': { latitude: 0, longitude: 0.0018 },
  'Lot 23': { latitude: -0.00015, longitude: 0 },
  'Lot 31': { latitude: -0.00015, longitude: 0 },
};

function withFillOpacity(color: string, opacity: number): string {
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(color || '');
  if (!hexMatch) return color;
  const value = parseInt(hexMatch[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getLotNumberLabel(lot: any): string {
  const rawName = String(lot?.name || lot?.lot_name || '').trim();
  const rawTag = String(lot?.tag || '').trim();
  const rawId = String(lot?.id || '').trim();
  const combined = `${rawName} ${rawTag} ${rawId}`.toLowerCase();

  if (combined.includes('highland') && combined.includes('garage')) return 'HSG';
  if (combined.includes('union circle') && combined.includes('garage')) return 'UCG';
  if (combined === 'hsg' || rawId.toLowerCase() === 'hsg' || rawTag.toUpperCase() === 'HSG') return 'HSG';
  if (combined.includes('ucg') || rawTag.toUpperCase() === 'UCG' || rawId.toLowerCase() === 'ucg') return 'UCG';

  const match = /lot\s*(\d+)/i.exec(rawName);
  if (match) return `Lot ${match[1]}`;

  if (/^\d+$/.test(rawTag)) return `Lot ${rawTag}`;
  if (/^\d+$/.test(rawId)) return `Lot ${rawId}`;

  return '';
}

function pointInPolygon(point: { latitude: number; longitude: number }, polygon: { latitude: number; longitude: number }[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersects =
      ((yi > point.longitude) !== (yj > point.longitude)) &&
      (point.latitude < ((xj - xi) * (point.longitude - yi)) / ((yj - yi) || 1) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

function getPolygonCenter(coordinates: { latitude: number; longitude: number }[]) {
  if (coordinates.length === 0) return null;

  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);

  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  };
}

function doesLabelFitLot(
  label: string,
  coordinate: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[],
  fontSize: number,
  mapSize: { width: number; height: number },
  region: { latitudeDelta: number; longitudeDelta: number },
) {
  if (!mapSize.width || !mapSize.height || !region.latitudeDelta || !region.longitudeDelta) return false;

  const labelWidth = label.length * fontSize * 0.68 + 8;
  const labelHeight = fontSize + 6;
  const halfLatitude = (labelHeight / 2) * region.latitudeDelta / mapSize.height;
  const halfLongitude = (labelWidth / 2) * region.longitudeDelta / mapSize.width;

  for (let row = 0; row <= 2; row++) {
    for (let column = 0; column <= 4; column++) {
      const point = {
        latitude: coordinate.latitude + (1 - row) * halfLatitude,
        longitude: coordinate.longitude + (column / 2 - 1) * halfLongitude,
      };
      if (!pointInPolygon(point, polygon)) return false;
    }
  }

  return true;
}

function getLotLabelCoordinate(
  coordinates: { latitude: number; longitude: number }[],
  label: string,
  fontSize: number,
  mapSize: { width: number; height: number },
  region: { latitudeDelta: number; longitudeDelta: number },
) {
  if (!coordinates || coordinates.length === 0) return null;

  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const latStep = (maxLat - minLat) / 10;
  const lngStep = (maxLng - minLng) / 10;
  const candidates: { latitude: number; longitude: number }[] = [];

  for (let row = 1; row <= 9; row++) {
    for (let col = 1; col <= 9; col++) {
      const latitude = minLat + row * latStep;
      const longitude = minLng + col * lngStep;
      candidates.push({ latitude, longitude });
    }
  }

  const fittingCandidates = candidates.filter((point) =>
    pointInPolygon(point, coordinates) &&
    doesLabelFitLot(label, point, coordinates, fontSize, mapSize, region)
  );

  return fittingCandidates.sort((a, b) => {
    const distanceA = Math.abs(a.latitude - centerLat) + Math.abs(a.longitude - centerLng);
    const distanceB = Math.abs(b.latitude - centerLat) + Math.abs(b.longitude - centerLng);
    return distanceA - distanceB;
  })[0] || null;
}

export default function EagleMap({ liveLots, selectedCampus = "Main campus" }: EagleMapProps) {
  const mapRef = useRef<MapView>(null);
  const untRegion = CAMPUS_REGIONS["Main campus"];
  const [sheetLot, setSheetLot] = useState<any | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitudeDelta: untRegion.latitudeDelta,
    longitudeDelta: untRegion.longitudeDelta,
  });
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const region = CAMPUS_REGIONS[selectedCampus];
    if (region) {
      mapRef.current?.animateToRegion(region, 800);
    }
  }, [selectedCampus]);

  const handleZoomIn = async () => {
    if (!mapRef.current) return;
    const camera = await mapRef.current.getCamera();
    if (camera && camera.zoom !== undefined) {
      mapRef.current.animateCamera({ zoom: camera.zoom + 1 }, { duration: 300 });
    }
  };

  const handleZoomOut = async () => {
    if (!mapRef.current) return;
    const camera = await mapRef.current.getCamera();
    if (camera && camera.zoom !== undefined) {
      mapRef.current.animateCamera({ zoom: camera.zoom - 1 }, { duration: 300 });
    }
  };

  const labelFontSize = Math.max(10, Math.min(15, 15 - mapRegion.latitudeDelta * 500));

  const lot20LabelId = useMemo(() => {
    const lot20Zones = liveLots.filter(
      (lot) => lot.isVisible !== false && getLotNumberLabel(lot) === 'Lot 20',
    );
    const lot20LabelLot = lot20Zones.find((lot) =>
      getLotLabelCoordinate(lot.coordinates || [], 'Lot 20', labelFontSize, mapSize, mapRegion),
    ) || lot20Zones[0];
    return lot20LabelLot?.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLots, labelFontSize, mapSize.width, mapSize.height, mapRegion.latitudeDelta, mapRegion.longitudeDelta]);

  const lotLabels = useMemo(() => {
    if (liveLots.length === 0 || mapRegion.latitudeDelta > 0.01) return [];

    return liveLots.reduce<{ lot: any; coordinate: { latitude: number; longitude: number } }[]>((acc, lot) => {
      if (lot.isVisible === false) return acc;

      const lotName = getLotNumberLabel(lot);
      if (!lotName) return acc;
      if (lotName === 'Lot 20' && lot.id !== lot20LabelId) return acc;

      const labelCoordinate = getLotLabelCoordinate(
        lot.coordinates || [],
        lotName,
        labelFontSize,
        mapSize,
        mapRegion,
      );
      const markerCoordinate = labelCoordinate || (
        lotName === 'Lot 20' ? getPolygonCenter(lot.coordinates || []) : null
      );
      if (!markerCoordinate) return acc;

      const offset = LOT_LABEL_OFFSETS[lotName];
      const displayCoordinate = offset
        ? {
            latitude: markerCoordinate.latitude + offset.latitude,
            longitude: markerCoordinate.longitude + offset.longitude,
          }
        : markerCoordinate;

      acc.push({ lot, coordinate: displayCoordinate });
      return acc;
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLots, labelFontSize, mapSize.width, mapSize.height, mapRegion.latitudeDelta, mapRegion.longitudeDelta, lot20LabelId]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={untRegion}
        onLayout={(event) => setMapSize(event.nativeEvent.layout)}
        onRegionChangeComplete={(region) => setMapRegion((prev) => {
          const unchanged =
            Math.abs(prev.latitudeDelta - region.latitudeDelta) < 1e-7 &&
            Math.abs(prev.longitudeDelta - region.longitudeDelta) < 1e-7;
          if (unchanged) return prev;
          return {
            latitudeDelta: region.latitudeDelta,
            longitudeDelta: region.longitudeDelta,
          };
        })}
        showsUserLocation={true}
        customMapStyle={MAP_STYLES}
      >
        {liveLots.length > 0 && liveLots.map((lot) => (
          <Polygon
            key={lot.id}
            coordinates={lot.coordinates}
            fillColor={lot.isVisible === false ? 'rgba(0,0,0,0)' : withFillOpacity(lot.fillColor, LOT_FILL_OPACITY)}
            strokeColor={lot.isVisible === false ? 'rgba(0,0,0,0)' : lot.strokeColor}
            strokeWidth={lot.isVisible === false ? 0 : 2}
            tappable={lot.isVisible !== false}
            onPress={() => {
              if (lot.isVisible === false) return;
              setSheetLot(lot);
            }}
          />
        ))}
        {lotLabels.map(({ lot, coordinate }) => (
          <Marker
            key={`${lot.id}-label`}
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => setSheetLot(lot)}
          >
            <View style={styles.lotLabel}>
              <Text style={{
                color: lot.strokeColor || lot.fillColor || '#1f1f1f',
                fontSize: labelFontSize,
                fontWeight: '800',
                lineHeight: labelFontSize + 2,
                textAlign: 'center',
                includeFontPadding: false,
              }}>{getLotNumberLabel(lot)}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <LotDetailsSheet
        lot={sheetLot}
        visible={sheetLot !== null}
        onClose={() => setSheetLot(null)}
      />

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={24} color="#00853e" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={24} color="#00853e" />
        </TouchableOpacity>
      </View>

      <View style={styles.capacityContainer}>
        <View style={styles.capacityRow}>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#2ECC71" }]} />
            <Text style={styles.capacityText}>AVAILABLE</Text>
          </View>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#F39C12" }]} />
            <Text style={styles.capacityText}>NEAR CAPACITY</Text>
          </View>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#E74C3C" }]} />
            <Text style={styles.capacityText}>FULL</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  lotLabel: {
    backgroundColor: 'transparent',
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    bottom: 175,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  zoomButton: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#eee',
    width: '70%',
    alignSelf: 'center',
  },
  capacityContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
    paddingBottom: 12,
  },
  capacityRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "90%",
    backgroundColor: "#fff",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  capacityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  capacityDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
});