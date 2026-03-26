import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';


import { requestPermissions, getParkedLocation } from '../../modules/parkzen-core';
/**
 * EAGLEEYES MAP VIEW - FRONTEND HANDOFF NOTE
 * --------------------------------------------------------------------------
 * 1. NATIVE BRIDGE: 'requestPermissions' and 'getParkedLocation' are tied to 
 * the custom iOS Swift module (ParkzenCore). Do not change these names 
 * unless you update the Native Module in /modules/parkzen-core.
 * * 2. DATA SOURCE: The 'fetchLotDrawings' function currently hits our 
 * local Python FastAPI server (Port 5000). 
 * - To change Lot colors/data: Modify 'backend/app/main.py'
 * - To swap to real ParkZen API(waiting response from Fernando): Update the URL in the fetch() below.
 * * 3. MAP UI: We are using 'react-native-maps' with PROVIDER_GOOGLE. 
 * - To change map styles: Use the 'customMapStyle' prop on <MapView>.
 * - To add more layers: Add children (Markers/Polygons) inside <MapView>.
 * * 4. DEV TOOL: Long-press anywhere on the map to simulate a "Parking Event" 
 * since the simulator cannot detect physical driving.
 * --------------------------------------------------------------------------
 */
export default function MapScreen() {
  const [parkedLocation, setParkedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [liveLots, setLiveLots] = useState<any[]>([]); 

  const untRegion = {
    latitude: 33.2140,
    longitude: -97.1475,
    latitudeDelta: 0.012, 
    longitudeDelta: 0.012,
  };

  useEffect(() => {
    const setupParkZen = async () => {
      try {
        await requestPermissions();
      } catch (error) {
        console.log("Bridge not ready:", error);
      }
    };

    const fetchLotDrawings = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/lots', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Map the Python JSON to React Native's Polygon format
          const formattedLots = data.map((lot: any) => ({
            id: lot.id,
            name: lot.name,
            fillColor: lot.isFull ? 'rgba(255, 0, 0, 0.4)' : 'rgba(0, 133, 62, 0.4)',
            strokeColor: lot.isFull ? '#FF0000' : '#00853E',
            coordinates: lot.polygonCoordinates
          }));

          setLiveLots(formattedLots);
        }
      } catch (error) {
        console.log("Could not fetch lots from backend:", error);
      }
    };

    setupParkZen();
    fetchLotDrawings();
  }, []);

  const handleFindMyCar = async () => {
    try {
      const loc = await getParkedLocation();
      if (loc && loc.latitude) {
        setParkedLocation(loc);
        Alert.alert("Car Found!", "Dropping a pin at your location.");
      } else if (parkedLocation) {
        Alert.alert("Simulated Car Found!", "Showing the manually dropped pin.");
      } else {
        Alert.alert("No Parking Detected", "ParkZen hasn't detected a parking event.");
      }
    } catch (error) {
      Alert.alert("Bridge Error", "Could not reach the native SDK.");
    }
  };

  const handleLongPress = (event: any) => {
    const coords = event.nativeEvent.coordinate;
    setParkedLocation(coords);
    Alert.alert("Test Pin Dropped", "Simulating that you parked here.");
  };

  return (
    <View style={styles.container}>
      <MapView 
        style={styles.map} 
        provider={PROVIDER_GOOGLE} 
        initialRegion={untRegion}
        showsUserLocation={true}
        onLongPress={handleLongPress}
      >
        {liveLots.map((lot) => (
          <Polygon
            key={lot.id}
            coordinates={lot.coordinates}
            fillColor={lot.fillColor}
            strokeColor={lot.strokeColor}
            strokeWidth={2}
          />
        ))}

        {parkedLocation && (
          <Marker coordinate={parkedLocation} title="My Car" pinColor="#0000FF" />
        )}
      </MapView>

      <TouchableOpacity style={styles.findCarButton} onPress={handleFindMyCar}>
        <Ionicons name="car" size={24} color="white" />
        <Text style={styles.findCarText}>Find My Car</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  findCarButton: {
    position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#00853E',
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 5,
  },
  findCarText: { color: 'white', fontWeight: 'bold', fontSize: 18, marginLeft: 10, }
});