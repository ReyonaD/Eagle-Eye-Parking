import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import EagleMap from '../../components/EagleMap';
//import { requestPermissions } from '../../modules/parkzen-core';

// const BACKEND_URL = Platform.OS === 'android' 
//   ? 'http://10.0.2.2:8000' 
//   : 'http://localhost:8000';
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

// Top Bar Component
function TopBar() {
  const router = useRouter();
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
        <TouchableOpacity style={styles.bellWrapper} onPress={() => router.push('/(tabs)/alerts')}>
          <Ionicons name="notifications-outline" size={28} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MapScreen() {
  const [liveLots, setLiveLots] = useState<any[]>([]);
  
  // Dropdown States
  const [selectedCampus, setSelectedCampus] = useState("Main campus");
  const [openCampus, setOpenCampus] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState("Eagle");
  const [openPermit, setOpenPermit] = useState(false);

  const campuses = ["Main campus", "Discovery Park", "Frisco Landing"];
  const permits = [
    "Eagle", "Remote", "Faculty", "A-Reserved", 
    "Visitor", "Hall Director", "Resident Reserved", "Motorcycle"
  ];

  useEffect(() => {
    // const setupParkZen = async () => {
    //   try {
    //     await requestPermissions();
    //   } catch (error) {
    //     console.warn("ParkZen requestPermissions failed.");
    //   }
    // };

    const fetchParkZenLots = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/lots`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'}
        });
        if (!response.ok) throw new Error(`Backend returned ${response.status}`);

        const data = await response.json();
        
        if (!Array.isArray(data)) {
          setLiveLots([]);
          return;
        }

        const formattedLots = data.map((lot: any, index: number) => {
          const mappedCoords = (lot.vertices || []).map((v: any) => ({
            latitude: parseFloat(v.latitude) || parseFloat(v.lat),
            longitude: parseFloat(v.longitude) || parseFloat(v.lng) || parseFloat(v.lon)
          })).filter((v: any) => !isNaN(v.latitude) && !isNaN(v.longitude));

          if (mappedCoords.length === 0) return null;

          let fillColor = 'rgba(53, 53, 53, 0.4)';
          let strokeColor = '#6c6b6b';

          if (lot.fillColor) {
             fillColor = lot.fillColor; 
             strokeColor = lot.fillColor === '#2ECC71' ? '#27AE60' : 
                           lot.fillColor === '#F39C12' ? '#D68910' : 
                           lot.fillColor === '#E74C3C' ? '#C0392B' : strokeColor;
          }

          let percentFull = "N/A";
          if (lot.occupancy && lot.occupancy.lastUpdatedVia) {
             const method = lot.occupancy.lastUpdatedVia;
             if (lot.occupancy[method] && lot.occupancy[method].estimate !== undefined) {
                 percentFull = Math.round(lot.occupancy[method].estimate * 100) + '%';
             }
          }

          return {
            ...lot,
            id: lot.id || index.toString(),
            name: lot.lot_name || lot.name || `Lot ${index}`,
            fillColor,
            strokeColor,
            coordinates: mappedCoords,
            percentEmpty: lot.percentEmpty,
            isFull: lot.isFull || lot.status === 'Full',
            permits: lot.permits && Array.isArray(lot.permits) ? lot.permits.join(', ') : 'Unknown'
          };
        }).filter((lot: any) => lot !== null);

        setLiveLots(formattedLots);
      } catch (error) {
        console.error("Error fetching lots:", error);
        setLiveLots([]); 
      }
    };

    //setupParkZen();
    fetchParkZenLots();
  }, []);

  return (
    <View style={styles.container}>
      <TopBar />

      {/* ROW: CAMPUS (left) + PERMIT (right) */}
      <View style={styles.dropdownRow}>
        
        {/* CAMPUS DROPDOWN */}
        <View style={[styles.dropdownWrapper, { marginRight: 8 }]}>
          <Text style={styles.dropdownLabel}>CAMPUS</Text>
          <TouchableOpacity style={styles.dropdownBox} onPress={() => setOpenCampus(!openCampus)}>
            <Text style={styles.dropdownText}>{selectedCampus}</Text>
            <Ionicons name={openCampus ? "chevron-up" : "chevron-down"} size={20} color="#333" />
          </TouchableOpacity>
          {openCampus && (
            <View style={styles.dropdownList}>
              {campuses.map((campus) => (
                <TouchableOpacity
                  key={campus}
                  style={styles.dropdownItem}
                  onPress={() => { setSelectedCampus(campus); setOpenCampus(false); }}
                >
                  <Text style={styles.dropdownItemText}>{campus}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* PERMIT DROPDOWN */}
        <View style={[styles.dropdownWrapper, { marginLeft: 8 }]}>
          <Text style={styles.dropdownLabel}>PERMIT</Text>
          <TouchableOpacity style={styles.dropdownBox} onPress={() => setOpenPermit(!openPermit)}>
            <Text style={styles.dropdownText}>{selectedPermit}</Text>
            <Ionicons name={openPermit ? "chevron-up" : "chevron-down"} size={20} color="#333" />
          </TouchableOpacity>
          {openPermit && (
            <View style={styles.dropdownList}>
              <ScrollView nestedScrollEnabled={true}>
                {permits.map((permit) => (
                  <TouchableOpacity
                    key={permit}
                    style={styles.dropdownItem}
                    onPress={() => { setSelectedPermit(permit); setOpenPermit(false); }}
                  >
                    <Text style={styles.dropdownItemText}>{permit}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </View>

      {/* THE MAP AREA */}
      <View style={styles.mapArea}>
        <EagleMap liveLots={liveLots} />
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  
  // Top Bar
  topBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#eee', zIndex: 20 },
  topBarSide: { width: 50, justifyContent: 'center' },
  bellWrapper: { alignItems: 'flex-end' },
  logo: { width: 100, height: 55, resizeMode: 'contain' },
  appName: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#00853E' },

  // Dropdown Row Layout (Must have high zIndex to float over map)
  dropdownRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#fff',
    zIndex: 10,       // Crucial for iOS overlapping
    elevation: 10,    // Crucial for Android overlapping
  },
  dropdownWrapper: {
    flex: 1,
    backgroundColor: "#fff",
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
    position: 'absolute',
    top: 65,
    left: 0,
    right: 0,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    maxHeight: 135,
    overflow: "hidden",
    zIndex: 1000,     // Forces list to render on top of the map below
    elevation: 1000,
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

  // Map Area needs to flex to fill remaining space, but have a lower zIndex than dropdowns
  mapArea: {
    flex: 1,
    zIndex: 1,
    elevation: 1,
  }
});