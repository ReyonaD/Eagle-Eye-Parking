import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, FlatList, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLots } from '../../context/LotsContext';
import EagleMap from '../../components/EagleMap';
//import { requestPermissions } from '../../modules/parkzen-core';
import { SafeAreaView} from 'react-native-safe-area-context';
//const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;


// Top Bar Component
// function TopBar() {
//   const router = useRouter();
//   return (
//     <View style={styles.topBar}>
      
//       {/* LEFT: Logo + App Name */}
//       <View style={styles.leftGroup}>
//         <Image
//           source={require('../../assets/images/Logo_EagleEye.png')}
//           style={styles.logo}
//         />
//         <Text style={styles.appNameLeft}>EagleEyes</Text>
//       </View>

//       {/* RIGHT: Bell */}
//       <TouchableOpacity style={styles.bellWrapper} onPress={() => router.push('/(tabs)/alerts')}>
//         <Ionicons name="notifications-outline" size={27} color="#333" />
//       </TouchableOpacity>

//     </View>
//   );
// }
export default function MapScreen() {
  //consume the global data
  const { lots, isLoading, lastRefreshAt } = useLots();
  console.log("MapScreen Render - isLoading:", isLoading, "Lots count:", lots?.length);

  const refreshLabel = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Waiting for sync';
  // Dropdown States
  const [selectedCampus, setSelectedCampus] = useState("Main campus");
  const [openCampus, setOpenCampus] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState("All Permits");
  const [openPermit, setOpenPermit] = useState(false);
  // Measured bottom edge of the dropdown row; overlays anchor to it on any screen size
  const [dropdownRowBottom, setDropdownRowBottom] = useState(0);
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading EagleEyes Maps...</Text>
      </View>
    );
  }
  const campuses = ["Main campus", "Discovery Park", "Frisco Landing"];
  const permits = [
    "All Permits",
    "Eagle", "Remote", "Faculty and Staff", "A-Reserved",
    "Resident", "Resident Reserved", "Hall Director",
    "Visitor", "Motorcycle", "Evening", "Night",
    "HSG", "Premium Parking", "Zip Car"
  ];
  const filteredLots = (lots || []).map((lot: any) => {
    if (selectedPermit === "All Permits") return { ...lot, isVisible: true };
    
    // 1. Guard against empty data, but REMOVE the Array.isArray strict check
    if (!lot?.permits) return { ...lot, isVisible: false };

    // FIXED: Handle both Arrays AND Comma-Separated Strings
    let permitsArray = [];
    if (Array.isArray(lot.permits)) {
      permitsArray = lot.permits;
    } else if (typeof lot.permits === 'string') {
      permitsArray = lot.permits.split(','); // Split "Eagle, Faculty" into ["Eagle", " Faculty"]
    } else {
      return { ...lot, isVisible: false }; 
    }

    const permitMap: { [key: string]: string[] } = {
      "Faculty and Staff": ["fs", "f/s", "faculty", "staff"],
      "A-Reserved": ["areserved", "a"],
      "Eagle": ["eagle", "e"],
      "Resident": ["resident", "res"],
      "Resident Reserved": ["residentreserved"],
      "Remote": ["remote"],
    };

    const clean = (s: any) => {
      if (typeof s !== 'string') return '';
      return s.toLowerCase()
              .replace(/\s+/g, '')             // Remove spaces
              .replace(/\([a-z0-9]\)/g, '')    // Remove (N), (D)
              .replace(/[^a-z0-9]/g, '')       // Remove symbols
              .trim();
    };

    const target = clean(selectedPermit);
    const allowedCodes = permitMap[selectedPermit] 
      ? permitMap[selectedPermit].map(c => clean(c)) 
      : [target];

    // Loop over our new safe permitsArray
    const isVisible = permitsArray.some((p: any) => {
      const lotPermitCleaned = clean(p);
      
      // Match if exact or if the backend string contains our target
      return allowedCodes.includes(lotPermitCleaned) || lotPermitCleaned.includes(target);
    });

    return { ...lot, isVisible };
  });
  return (
     <SafeAreaView style={styles.container} edges={['right', 'left']}>

      {/* ROW: CAMPUS (left) + PERMIT (right) */}
      <View
        style={styles.dropdownRow}
        onLayout={(e) => setDropdownRowBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
      >
        {/* CAMPUS TRIGGER */}
        <View style={[styles.dropdownWrapper, { marginRight: 8 }]}>
          <Text style={styles.dropdownLabel}>CAMPUS</Text>
          <TouchableOpacity style={styles.dropdownBox} onPress={() => { setOpenCampus(!openCampus); setOpenPermit(false); }}>
            <Text style={styles.dropdownText}>{selectedCampus}</Text>
            <Ionicons name={openCampus ? "chevron-up" : "chevron-down"} size={27} color="#333" />
          </TouchableOpacity>
        </View>

        {/* PERMIT TRIGGER */}
        <View style={[styles.dropdownWrapper, { marginLeft: 8 }]}>
          <Text style={styles.dropdownLabel}>PERMIT</Text>
          <TouchableOpacity style={styles.dropdownBox} onPress={() => { setOpenPermit(!openPermit); setOpenCampus(false); }}>
            <Text style={styles.dropdownText}>{selectedPermit}</Text>
            <Ionicons name={openPermit ? "chevron-up" : "chevron-down"} size={27} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.liveStatusBar}>
        <Ionicons name="time-outline" size={14} color="#5d6d7e" />
        <Text style={styles.liveStatusText}>Last synced: {refreshLabel}</Text>
      </View>

      {/* THE MAP AREA */}
      <View style={styles.mapArea} pointerEvents={(openCampus || openPermit) ? "none" : "auto"}>
        <EagleMap
          liveLots={filteredLots}
          selectedCampus={selectedCampus}
        />
      </View>

      {/* DROPDOWN OVERLAYS - rendered at root so touch events work over map */}
      {openCampus && (
        <FlatList
          style={[styles.dropdownOverlay, styles.dropdownOverlayLeft, { top: dropdownRowBottom - 6 }]}
          data={campuses}
          keyExtractor={(item) => item}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setSelectedCampus(item); setOpenCampus(false); }}
            >
              <Text style={styles.dropdownItemText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}
      {openPermit && (
        <FlatList
          style={[styles.dropdownOverlay, styles.dropdownOverlayRight, { top: dropdownRowBottom - 6 }]}
          data={permits}
          keyExtractor={(item) => item}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setSelectedPermit(item); setOpenPermit(false); }}
            >
              <Text style={styles.dropdownItemText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },

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
    zIndex: 1000,
    elevation: 1000,
  },
  dropdownOverlay: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    maxHeight: 280,
    zIndex: 1000,
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dropdownOverlayLeft: {
    left: 16,
    right: '50%',
    marginRight: 8,
  },
  dropdownOverlayRight: {
    left: '50%',
    right: 16,
    marginLeft: 8,
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
  },
  leftGroup: {
  flexDirection: 'row',
  alignItems: 'center'
  },

  appNameLeft: {
  fontSize: 18,
  fontWeight: 'bold',
  color: '#00853E',
  marginLeft: 8
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});