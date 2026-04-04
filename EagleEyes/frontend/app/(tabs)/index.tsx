import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, Image, ScrollView, Platform } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

import { requestPermissions, getParkedLocation } from '../../modules/parkzen-core';
const BACKEND_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:8000' 
  : 'http://localhost:8000';

  //console.log("DEBUG: Current Backend URL is:", BACKEND_URL);
// Top Bar Component
function TopBar() {
  return (
    <View style={styles.topBar}>
      {/* Left: Logo - fixed width */}
      <View style={styles.topBarSide}>
        <Image
          source={require('../../assets/images/Logo_EagleEye.png')}
          style={styles.logo}
        />
      </View>

      {/* Center: App Name */}
      <Text style={styles.appName}>EagleEyes</Text>

      {/* Right: Bell - fixed width */}
      <View style={styles.topBarSide}>
        <TouchableOpacity style={styles.bellWrapper}>
          <Ionicons name="notifications-outline" size={28} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const [parkedLocation, setParkedLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [liveLots, setLiveLots] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState("Main campus");
  const [openCampus, setOpenCampus] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState("Eagle");
  const [openPermit, setOpenPermit] = useState(false);

  const campuses = ["Main campus", "Discovery Park", "Frisco Landing"];
  const permits = [
    "Eagle",
    "Remote",
    "Faculty",
    "A-Reserved",
    "Visitor",
    "Hall Director",
    "Resident Reserved",
    "Motorcycle"
  ];

  const untRegion = {
    latitude: 33.2140,
    longitude: -97.1475,
    latitudeDelta: 0.012, 
    longitudeDelta: 0.012,
  };

  useEffect(() => {
    const setupParkZen = async () => {
      try {
        console.log("Attempting to request ParkZen permissions...");
        const result = await requestPermissions();
        console.log("ParkZen permissions result:", result);
      } catch (error) {
        console.warn("ParkZen requestPermissions failed (this is expected on Android simulator):", error);
        // Don't crash the app if permissions fail
      }
    };

    const fetchParkZenLots = async () => {
      try {
        console.log("Fetching parking lots from backend...");
        const response = await fetch(`${BACKEND_URL}/api/lots`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json'}
        });
        if (!response.ok) 
          throw new Error(`Backend returned ${response.status}: ${response.statusText}`);

        const data = await response.json();
        console.log("Raw backend data:", data);
        
        if (!Array.isArray(data)) {
          console.warn("Backend data is not an array:", data);
          setLiveLots([]);
          return;
        }

        const formattedLots = data.map((lot: any, index: number) => {
          const mappedCoords = (lot.vertices || []).map((v: any) => ({
            latitude: parseFloat(v.latitude) || parseFloat(v.lat),
            longitude: parseFloat(v.longitude) || parseFloat(v.lng) || parseFloat(v.lon)
          }))
          .filter((v: any) => !isNaN(v.latitude) && !isNaN(v.longitude));

          if (mappedCoords.length === 0) {
            console.warn(`Lot ${index} has no valid coordinates:`, lot.vertices);
            return null;
          }

          // Determine colors based on occupancy status
          let fillColor = 'rgba(53, 53, 53, 0.4)'; // Default: Unknown (Grey)
          let strokeColor = '#6c6b6b';
          let capacityStatus = "Unknown";
          let percentFull = "N/A";

          // Use ParkZen's Native Fill Color if available
          if (lot.fillColor) {
             fillColor = lot.fillColor; 
             strokeColor = lot.fillColor === '#2ECC71' ? '#27AE60' : 
                           lot.fillColor === '#F39C12' ? '#D68910' : 
                           lot.fillColor === '#E74C3C' ? '#C0392B' : strokeColor;
          }

          // Grab the UI Status Title
          if (lot.infoSheetTitle) {
             capacityStatus = lot.infoSheetTitle;
          }

          // Dig into the 0-1 Occupancy Object
          if (lot.occupancy && lot.occupancy.lastUpdatedVia) {
             const method = lot.occupancy.lastUpdatedVia;
             if (lot.occupancy[method] && lot.occupancy[method].estimate !== undefined) {
                 percentFull = Math.round(lot.occupancy[method].estimate * 100) + '%';
             }
          }
          const readablePermits = lot.permits && Array.isArray(lot.permits)
            ? lot.permits.join(', ') 
            : 'Unknown';

          return {
            ...lot,
            id: lot.id || index.toString(),
            name: lot.lot_name || lot.name || lot.lotName || lot.title || (lot.id ? `Lot ${lot.id}` : `Lot ${index}`),
            fillColor,
            strokeColor,
            coordinates: mappedCoords,
            percentEmpty: lot.percentEmpty,
            isFull: lot.isFull || lot.status === 'Full',
            permits: lot.permits && Array.isArray(lot.permits) ? lot.permits.join(', ') : 'Unknown'
          };
        }).filter((lot: any) => lot !== null);

        setLiveLots(formattedLots);
        console.log("Successfully fetched and formatted lots:", formattedLots.length);
      } catch (error) {
        console.error("Error fetching lots from backend:", error);
        setLiveLots([]); // Set empty array to prevent render errors
      }
    };

    // Run both setup tasks
    setupParkZen();
    fetchParkZenLots();
  }, []);


  const handleFindMyCar = async () => {
    try {
      console.log("Finding parked car location...");
      const loc = await getParkedLocation();
      console.log("Got location:", loc);
      
      if (loc && loc.latitude && loc.longitude) {
        setParkedLocation(loc);
        Alert.alert("Car Found!", `Lat: ${loc.latitude.toFixed(4)}, Lon: ${loc.longitude.toFixed(4)}`);
      } else if (parkedLocation) {
        Alert.alert("Simulated Car Found!", "Showing the manually dropped pin.");
      } else {
        Alert.alert("No Parking Detected", "Long-press the map to simulate parking, or ParkZen hasn't detected a parking event yet.");
      }
    } catch (error) {
      console.warn("Error in getParkedLocation:", error);
      if (parkedLocation) {
        Alert.alert("Using Simulated Location", "Showing manually dropped pin.");
      } else {
        Alert.alert("Location Unavailable", "Tap the map to mark a location.");
      }
    }
  };

  const handleLongPress = (event: any) => {
    const coords = event.nativeEvent.coordinate;
    setParkedLocation(coords);
    Alert.alert("Test Pin Dropped", "Simulating that you parked here.");
  };

  return (
    <View style={styles.container}>
      <TopBar />

      {/* ROW: CAMPUS (left) + PERMIT (right) */}
      <View style={styles.row}>
        {/* CAMPUS DROPDOWN */}
        <View style={[styles.dropdownWrapper, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.dropdownLabel}>CAMPUS</Text>
          <TouchableOpacity
            style={styles.dropdownBox}
            onPress={() => setOpenCampus(!openCampus)}
          >
            <Text style={styles.dropdownText}>{selectedCampus}</Text>
            <Ionicons
              name={openCampus ? "chevron-up" : "chevron-down"}
              size={20}
              color="#333"
            />
          </TouchableOpacity>
          {openCampus && (
            <View style={styles.dropdownList}>
              {campuses.map((campus) => (
                <TouchableOpacity
                  key={campus}
                  style={styles.dropdownItem}
                  onPress={() => {
                    setSelectedCampus(campus);
                    setOpenCampus(false);
                  }}
                >
                  <Text style={styles.dropdownItemText}>{campus}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* PERMIT DROPDOWN */}
        <View style={[styles.dropdownWrapper, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.dropdownLabel}>PERMIT</Text>
          <TouchableOpacity
            style={styles.dropdownBox}
            onPress={() => setOpenPermit(!openPermit)}
          >
            <Text style={styles.dropdownText}>{selectedPermit}</Text>
            <Ionicons
              name={openPermit ? "chevron-up" : "chevron-down"}
              size={20}
              color="#333"
            />
          </TouchableOpacity>
          {openPermit && (
            <View style={styles.dropdownList}>
              <ScrollView nestedScrollEnabled={true}>
                {permits.map((permit) => (
                  <TouchableOpacity
                    key={permit}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedPermit(permit);
                      setOpenPermit(false);
                    }}
                  >
                    <Text style={styles.dropdownItemText}>{permit}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* MAP */}
      <MapView 
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
            fillColor={lot.fillColor}
            strokeColor={lot.strokeColor}
            strokeWidth={2}
            tappable={true}
            onPress={() => {
              // Filter out long coordinate arrays so the alert is readable
              const { vertices, coordinates, fillColor, strokeColor, id, name, ...debugData } = lot;
              
              Alert.alert(
                lot.name,
                `Permits: ${lot.permits}\n` +
                `Percent Empty: ${lot.percentEmpty !== undefined ? lot.percentEmpty + '%' : 'Unknown'}\n` +
                `Is Full: ${lot.isFull ? 'Yes' : 'No'}\n\n`
                // `--- Raw Backend Data ---\n` +
                // JSON.stringify(debugData, null, 2)
              );
            }}
          />
        ))}
        {parkedLocation && (
          <Marker coordinate={parkedLocation} title="My Car" pinColor="#0000FF" />
        )}
      </MapView>

      {/* FIND MY CAR BUTTON */}
      <TouchableOpacity style={styles.findCarButton} onPress={handleFindMyCar}>
        <Ionicons name="car" size={24} color="white" />
        <Text style={styles.findCarText}>Find My Car</Text>
      </TouchableOpacity>

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

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  map: { flex: 1, width: '100%' },
  findCarButton: {
    position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: '#00853E',
    flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 5,
  },
  findCarText: { color: 'white', fontWeight: 'bold', fontSize: 18, marginLeft: 10 },

  // Top Bar
  topBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#eee' },
  topBarSide: { width: 50, justifyContent: 'center' },
  bellWrapper: { alignItems: 'flex-end' },
  logo: { width: 100, height: 55, resizeMode: 'contain' },
  appName: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#00853E' },

  // Dropdown Row
  row: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 10,
  },

  // Dropdown
  dropdownWrapper: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dropdownLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#777",
    marginBottom: 4,
  },
  dropdownBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#f9f9f9",
  },
  dropdownText: {
    fontSize: 14,
    color: "#333",
  },
  dropdownList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    maxHeight: 135,
    overflow: "hidden",
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#333",
  },

  // Capacity Indicator at Bottom
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
