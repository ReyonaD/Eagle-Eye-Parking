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

export default function EagleMap({ liveLots, selectedCampus = "Main campus" }: EagleMapProps) {
  const mapRef = useRef<MapView>(null);
  const [parkedLocation, setParkedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [sheetLot, setSheetLot] = useState<any | null>(null);


  useEffect(() => {
    const region = CAMPUS_REGIONS[selectedCampus];
    if (region) {
      mapRef.current?.animateToRegion(region, 800);
    }
  }, [selectedCampus]);

  const untRegion = CAMPUS_REGIONS["Main campus"];


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

  return (
    <View style={styles.container}>
      {/* MAP */}
      <MapView 
        ref={mapRef}
        style={styles.map} 
        provider={PROVIDER_GOOGLE} 
        initialRegion={untRegion}
        showsUserLocation={true}
        onLongPress={handleLongPress}
      >
        {liveLots.length > 0 && liveLots.map((lot) => (
          <Polygon
            key={lot.id}
            coordinates={lot.coordinates}
            fillColor={lot.isVisible === false ? 'rgba(0,0,0,0)' : lot.fillColor}
            strokeColor={lot.isVisible === false ? 'rgba(0,0,0,0)' : lot.strokeColor}
            strokeWidth={lot.isVisible === false ? 0 : 2}
            tappable={lot.isVisible !== false}
            onPress={() => {
              if (lot.isVisible === false) return;
              setSheetLot(lot);
            }}
          />
        ))}
        {liveLots.map((lot) => {
          if (lot.isVisible === false) return null;
          const center = getLotCenter(lot.coordinates || []);
          if (!center) return null;

          return (
            <Marker key={`${lot.id}-label`} coordinate={center} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={styles.hsgMarker}>
                <Text style={styles.hsgMarkerText} numberOfLines={1} adjustsFontSizeToFit>
                  {lot.tag}
                </Text>
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
  hsgMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BDBDBD',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    elevation: 3,
  },
  hsgMarkerText: {
    color: '#333333',
    fontSize: 11,
    fontWeight: '700',
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