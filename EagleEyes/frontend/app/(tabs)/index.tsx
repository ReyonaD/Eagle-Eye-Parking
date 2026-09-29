import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, FlatList, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLots } from '../../context/LotsContext';
import { useUser } from '../../context/UserContext';
import EagleMap from '../../components/EagleMap';
import { consolidatePermits, lotMatchesPermitType, A_RESERVED, RESIDENT_RESERVED, STREET_PARKING } from '../../utils/permits';
//import { requestPermissions } from '../../modules/parkzen-core';
import { SafeAreaView} from 'react-native-safe-area-context';
//const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const MAP_HAZARD_FAB_BOTTOM = 80;

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
  const router = useRouter();
  //consume the global data
  const { lots, isLoading, lastRefreshAt, filterByPermit } = useLots();
  const { user } = useUser();
  console.log("MapScreen Render - isLoading:", isLoading, "Lots count:", lots?.length);

  const refreshLabel = lastRefreshAt
    ? new Date(lastRefreshAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Waiting for sync';
  // Dropdown States
  const [selectedCampus, setSelectedCampus] = useState("Main campus");
  const [openCampus, setOpenCampus] = useState(false);
  const [selectedPermit, setSelectedPermit] = useState("All Permits");
  const [openPermit, setOpenPermit] = useState(false);
  // Once the user explicitly picks a permit from the dropdown (even "All Permits"
  // again), that choice wins over the "only show my permit type" preference below.
  const [permitManuallySelected, setPermitManuallySelected] = useState(false);
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
  // Every option here must exactly match a real ParkZen permit name (after
  // normalizePermit's aliasing) or nothing will ever match it. Previously
  // "HSG", "Zip Car" and "Visitor"/"Premium Parking" didn't match any real
  // lot data and were dead selections — verified against a live permit pull.
  const permits = [
    "All Permits",
    "Eagle", "Remote", "Faculty and Staff", A_RESERVED,
    "Resident", RESIDENT_RESERVED, "Hall Director",
    "Motorcycle", "Evening", "Night",
    "Highland Street Garage Commuter", "Premium Parking (Visitor)", "Zip Car",
    "Business/Vendor", "Union Circle Garage",
    STREET_PARKING
  ];
  const filteredLots = (lots || []).map((lot: any) => {
    if (selectedPermit === "All Permits") return { ...lot, isVisible: true };
    if (!lot?.permits) return { ...lot, isVisible: false };

    // Listed lots' permitList is already consolidated (category + normalized
    // permits); other lots' raw permits need normalizing here. Either way this
    // ends up exact-matched below, same as the Lots tab's own permit filter —
    // no loose substring matching, so "Resident" can't accidentally pick up
    // lookalikes like "HSR-Resident" or "Resident Reserved".
    const groups: string[] = lot.category && Array.isArray(lot.permitList)
      ? lot.permitList
      : consolidatePermits(lot.permits);

    const isVisible = groups.some((p: string) => p.trim() === selectedPermit);
    return { ...lot, isVisible };
  });

  // "Only show my permit type" preference from Profile Setting, applied on top
  // of the CAMPUS/PERMIT dropdowns above rather than replacing them — but only
  // until the user explicitly picks something from the PERMIT dropdown, since
  // they should always be able to opt back into seeing every permit.
  const permitTypeFilteredLots = (filterByPermit && user.parkingProfile.permitType && !permitManuallySelected)
    ? filteredLots.map((lot) => ({
        ...lot,
        isVisible: lot.isVisible && lotMatchesPermitType(lot.permitList, user.parkingProfile.permitType),
      }))
    : filteredLots;

  // The PERMIT dropdown still reads "All Permits" while the preference above is
  // quietly narrowing the map underneath it — show the user's own permit type
  // instead so the label matches what's actually visible, until they've made
  // their own explicit choice.
  const permitDropdownLabel =
    filterByPermit && user.parkingProfile.permitType && selectedPermit === 'All Permits' && !permitManuallySelected
      ? user.parkingProfile.permitType
      : selectedPermit;

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
            <Text style={styles.dropdownText}>{permitDropdownLabel}</Text>
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
          liveLots={permitTypeFilteredLots}
          selectedCampus={selectedCampus}
        />
        <TouchableOpacity
          style={styles.hazardFab}
          onPress={() => router.push('/report-options')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Report a hazard"
        >
          <Ionicons name="warning" size={38} color="#FACC15" />
        </TouchableOpacity>
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
              onPress={() => { setSelectedPermit(item); setPermitManuallySelected(true); setOpenPermit(false); }}
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
  hazardFab: {
    position: 'absolute',
    right: 20,
    bottom: MAP_HAZARD_FAB_BOTTOM,
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: '#00853E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
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