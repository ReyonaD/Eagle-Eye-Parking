import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import LotDetailsSheet from './LotDetailsSheet';
import { Ionicons } from '@expo/vector-icons';
// import { getParkedLocation, requestPermissions } from '../modules/parkzen-core';

interface EagleMapProps {
  liveLots: any[];
  selectedCampus?: string;
}

const CAMPUS_REGIONS: Record<string, { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }> = {
  "Main campus":     { latitude: 33.2110, longitude: -97.1475, latitudeDelta: 0.018, longitudeDelta: 0.018 },
  "Discovery Park":  { latitude: 33.2549, longitude: -97.1520, latitudeDelta: 0.018, longitudeDelta: 0.018 },
  "Frisco Landing":  { latitude: 33.1858, longitude: -96.8055, latitudeDelta: 0.018, longitudeDelta: 0.018 },
};

// Hide POI/transit clutter so the lot polygons are the visual focus; roads
// and labels stay for orientation. Matches EagleMap.web.tsx.
const MAP_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// react-native-maps' Polygon has no separate fillOpacity prop like the web
// SDK does, so a lighter fill (matching the web version's look) has to be
// baked into the color itself as an alpha channel.
const LOT_FILL_OPACITY = 0.35;
const LOT_29_RESIDENT_RESERVE_PIN_SOUTH_OFFSET = 0.00015;
const LOT_29_RESIDENT_RESERVE_PIN_EAST_OFFSET = 0.00015;

function withFillOpacity(color: string, opacity: number): string {
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(color || '');
  if (!hexMatch) return color;
  const value = parseInt(hexMatch[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getLotCenter(coordinates: { latitude: number; longitude: number }[]) {
  if (coordinates.length === 0) return null;

  const totals = coordinates.reduce(
    (center, coordinate) => ({
      latitude: center.latitude + coordinate.latitude,
      longitude: center.longitude + coordinate.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: totals.latitude / coordinates.length,
    longitude: totals.longitude / coordinates.length,
  };
}

function getLotMarkerCenter(lot: any) {
  const center = getLotCenter(lot.coordinates || []);
  if (!center) return null;

  //Move the pin for Lot20 Eagle specifically
  const lotName = String(lot.name || lot.lot_name || '');
  const normalizedLotName = lotName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/\blot\s*20\b.*\beagle\b/i.test(lotName)) {
    const LOT_20_PIN_SOUTH_OFFSET = 0.0012;
    const LOT_20_PIN_EAST_OFFSET = 0.00015;
    return {
      ...center,
      latitude: center.latitude - LOT_20_PIN_SOUTH_OFFSET,
      longitude: center.longitude + LOT_20_PIN_EAST_OFFSET,
    };
  }
  //Overlappping Lot 24 so manually adjusting the pin for Lot 24 A-Reserved
  if (/\blot\s*24\b.*\ba[-\s]?reserved\b/i.test(lotName)) {
    // Adjust this number to change the northward position of the Lot 24 A-Reserved pin.
    const LOT_24_A_RESERVED_PIN_NORTH_OFFSET = 0.00015;
    return {
      ...center,
      latitude: center.latitude + LOT_24_A_RESERVED_PIN_NORTH_OFFSET,
    };
  }

  if (/\blot\s*29\b.*\bresident\s+reserve(?:d)?\b/i.test(normalizedLotName)) {
    return {
      ...center,
      latitude: center.latitude - LOT_29_RESIDENT_RESERVE_PIN_SOUTH_OFFSET,
      longitude: center.longitude + LOT_29_RESIDENT_RESERVE_PIN_EAST_OFFSET,
    };
  }

  return center;
}

function getGroupedMarkerCenter(lots: any[]) {
  const centers = lots
    .map(getLotMarkerCenter)
    .filter((center): center is { latitude: number; longitude: number } => center !== null);
  if (centers.length === 0) return null;

  const totals = centers.reduce(
    (center, lotCenter) => ({
      latitude: center.latitude + lotCenter.latitude,
      longitude: center.longitude + lotCenter.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    latitude: totals.latitude / centers.length,
    longitude: totals.longitude / centers.length,
  };
}

function getLotMarkerSize(coordinates: { latitude: number; longitude: number }[], tag: string) {
  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const mapScale = 18000;
  const fontSize = Math.max(8, Math.min(10, Math.min(
    longitudeSpan * mapScale * 0.7,
    latitudeSpan * mapScale * 0.7,
  ) * 0.4));
  const labelWidth = tag.length * fontSize * 0.7 + 8;
  const width = Math.max(13, Math.min(24, Math.max(longitudeSpan * mapScale * 0.55, labelWidth)));
  // Lot pin dynamic size
  return {
    width,
    height: Math.max(20, Math.min(30, latitudeSpan * mapScale * 0.55)),
    circleSize: width,
    fontSize,
  };
}

function shouldShowLotMarker(lot: any): boolean {
  const name = String(lot.lot_name || lot.name || '').trim();
  return /\blot\s+(?:[1-9]|[1-9]\d)\b/i.test(name)
    || /^(?:highland street garage|union circle garage)$/i.test(name);
}

function isLot29(lot: any): boolean {
  return /\blot\s*29\b/i.test(String(lot.name || lot.lot_name || ''));
}

function getLotMarkerGroups(lots: any[], latitudeDelta: number) {
  const groupingDistance = Math.max(0.00008, latitudeDelta * 0.08);
  const groups: { lots: any[]; center: { latitude: number; longitude: number } }[] = [];

  lots.forEach((lot) => {
    if (lot.isVisible === false || !shouldShowLotMarker(lot)) return;
    const center = getLotMarkerCenter(lot);
    if (!center) return;

    const isCloseToLot29 = latitudeDelta <= 0.003 && isLot29(lot);
    const existingGroup = groups.find((group) => {
      if (isCloseToLot29 || group.lots.some(isLot29)) return false;
      const latitudeDistance = group.center.latitude - center.latitude;
      const longitudeDistance = (group.center.longitude - center.longitude) * Math.cos(center.latitude * Math.PI / 180);
      return Math.hypot(latitudeDistance, longitudeDistance) <= groupingDistance;
    });

    if (existingGroup) {
      existingGroup.lots.push(lot);
      existingGroup.center = getGroupedMarkerCenter(existingGroup.lots) || existingGroup.center;
    } else {
      groups.push({ lots: [lot], center });
    }
  });

  return groups;
}

export default function EagleMap({ liveLots, selectedCampus = "Main campus" }: EagleMapProps) {
  const mapRef = useRef<MapView>(null);
  const untRegion = CAMPUS_REGIONS["Main campus"];
  const [parkedLocation, setParkedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [sheetLot, setSheetLot] = useState<any | null>(null);
  const [latitudeDelta, setLatitudeDelta] = useState(untRegion.latitudeDelta);


  useEffect(() => {
    const region = CAMPUS_REGIONS[selectedCampus];
    if (region) {
      mapRef.current?.animateToRegion(region, 800);
    }
  }, [selectedCampus]);

  const handleLongPress = (event: any) => {
    const coords = event.nativeEvent.coordinate;
    setParkedLocation(coords);
    Alert.alert("Test Pin Dropped", "Simulating that you parked here.");
  };

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

  const handleClusterPress = (center: { latitude: number; longitude: number }) => {
    const nextDelta = Math.max(0.002, latitudeDelta * 0.45);
    mapRef.current?.animateToRegion(
      {
        ...center,
        latitudeDelta: nextDelta,
        longitudeDelta: nextDelta,
      },
      400,
    );
  };

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView 
        ref={mapRef}
        style={styles.map} 
        provider={PROVIDER_GOOGLE}
        initialRegion={untRegion}
        onRegionChangeComplete={(region) => setLatitudeDelta(region.latitudeDelta)}
        showsUserLocation={true}
        onLongPress={handleLongPress}
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
        {getLotMarkerGroups(liveLots, latitudeDelta).map((group) => {
          const lot = group.lots[0];
          if (group.lots.length > 1) {
            return (
              <Marker
                key={`${group.lots.map((groupLot) => groupLot.id).join('-')}-cluster`}
                coordinate={group.center}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={() => handleClusterPress(group.center)}
              >
                <View style={styles.clusterMarker}>
                  <Text style={styles.clusterMarkerText}>{group.lots.length}</Text>
                </View>
              </Marker>
            );
          }

          const markerSize = getLotMarkerSize(lot.coordinates || [], lot.tag);

          return (
            <Marker
              key={`${group.lots.map((groupLot) => groupLot.id).join('-')}-label`}
              coordinate={group.center}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => setSheetLot(lot)}
            >
              <View
                style={[
                  styles.markerContainer,
                  {
                    width: markerSize.width,
                    height: markerSize.height + markerSize.circleSize / 2,
                  },
                ]}
              >
                <View
                  style={[
                    styles.markerCircle,
                    {
                      width: markerSize.circleSize,
                      height: markerSize.circleSize,
                      borderRadius: markerSize.circleSize / 2,
                    },
                  ]}
                />
                <View style={[styles.hsgMarker, markerSize]}>
                <Text style={[styles.hsgMarkerText, { fontSize: markerSize.fontSize }]} numberOfLines={1} adjustsFontSizeToFit>
                  {lot.tag}
                </Text>
                </View>
              </View>
            </Marker>
          );
        })}
        {parkedLocation && (
          <Marker coordinate={parkedLocation} title="My Car" pinColor="#0000FF" />
        )}
      </MapView>

      {/* LOT DETAILS BOTTOM SHEET */}
      <LotDetailsSheet
        lot={sheetLot}
        visible={sheetLot !== null}
        onClose={() => setSheetLot(null)}
      />

      {/* ZOOM Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      {/* FIND MY CAR BUTTON */}
      {/* <TouchableOpacity style={styles.findCarButton} onPress={handleFindMyCar}>
        <Ionicons name="car" size={24} color="white" />
        <Text style={styles.findCarText}>Find My Car</Text>
      </TouchableOpacity> */}

      {/* CAPACITY INDICATOR AT BOTTOM */}
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
  markerContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  markerCircle: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
    zIndex: 2,
  },
  clusterMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3366ff',
  },
  clusterMarkerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  hsgMarker: {
    width: 26,
    height: 40,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    elevation: 3,
  },
  hsgMarkerText: {
    color: '#333333',
    fontWeight: '700',
    paddingTop: 0,
    paddingHorizontal: 1,
    flexShrink: 1,
    textAlign: 'center',
    includeFontPadding: false,
    zIndex: 1,
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    bottom: 150, 
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
  findCarButton: {
    position: 'absolute', 
    bottom: 100, 
    alignSelf: 'center', 
    backgroundColor: '#00853E',
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 24,
    borderRadius: 30, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, 
    shadowRadius: 5, 
    elevation: 5,
  },
  findCarText: { 
    color: 'white', 
    fontWeight: 'bold', 
    fontSize: 18, 
    marginLeft: 10 
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