import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Image, FlatList, Platform, Animated, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLots } from '../../context/LotsContext';
import { useUser } from '../../context/UserContext';
import EagleMap from '../../components/EagleMap';
import { getPermitTypes } from '../../api/auth';
import {
  consolidatePermits, lotMatchesPermitType, STREET_PARKING,
  buildPermitOptions, getPermitDisplayLabel, isPerLotPermitCode, PermitOption,
} from '../../utils/permits';
//import { requestPermissions } from '../../modules/parkzen-core';
import { SafeAreaView} from 'react-native-safe-area-context';
//const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;

const MAP_HAZARD_FAB_BOTTOM = 60;

// Same amber as the "Near Capacity" occupancy color elsewhere in the app —
// reused here for "you're previewing, not looking at live data".
const PREVIEW_AMBER = '#F39C12';
const PREVIEW_AMBER_DARK = '#D68910';

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
  const { lots, isLoading, lastRefreshAt, filterByPermit, previewMode, setPreviewMode, actuallyNight, mapType, setMapType } = useLots();
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
  const [mapSettingsOpen, setMapSettingsOpen] = useState(false);
  // Live ParkZen permit types, grouped so "A01".."A95" / "Lot NN Resident
  // Reserve" collapse into one row each instead of cluttering the list —
  // same source and grouping as Profile Setting's permit picker.
  const [permitTypes, setPermitTypes] = useState<string[]>([
    "Eagle", "Remote", "Faculty and Staff", "A-Reserved",
    "Resident", "Resident Reserved", "Hall Director", "Motorcycle",
    "Evening", "Night", "Highland Street Garage Commuter",
    "Premium Parking (Visitor)", "Zip Car", "Business/Vendor", "Union Circle Garage",
  ]);
  // Which group's lot picker is open (e.g. "A-Reserved"), or null.
  const [openGroupLabel, setOpenGroupLabel] = useState<string | null>(null);

  useEffect(() => {
    getPermitTypes()
      .then((types: string[]) => {
        if (Array.isArray(types) && types.length > 0) setPermitTypes(types);
      })
      .catch(() => {
        // Keep the fallback list — the dropdown still works, just not live.
      });
  }, []);

  // Street Parking isn't a real ParkZen permit type — it's this app's own
  // name-based category (see utils/permits.ts) — so it's added in alongside
  // the live/fallback list rather than coming from it.
  const permitOptions = useMemo(() => buildPermitOptions(permitTypes, [STREET_PARKING]), [permitTypes]);
  const openGroup = permitOptions.find((o): o is Extract<PermitOption, { kind: 'group' }> =>
    o.kind === 'group' && o.label === openGroupLabel
  );

  // Subtle periodic wiggle on the hazard button to draw the eye to it,
  // without being distracting — a quick shake every few seconds, not constant.
  const hazardShake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(4000),
        Animated.timing(hazardShake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(hazardShake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(hazardShake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(hazardShake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hazardShake]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading EagleEyes Maps...</Text>
      </View>
    );
  }
  const campuses = ["Main campus", "Discovery Park", "Frisco Landing"];
  const filteredLots = (lots || []).map((lot: any) => {
    if (selectedPermit === "All Permits") return { ...lot, isVisible: true };

    // A specific per-lot pick (e.g. "Lot 16 Resident Reserve") means "show
    // only the one physical lot this exact permit belongs to" — that
    // distinction only survives in the lot's raw ParkZen codes, since the
    // consolidated permitList collapses every per-lot code into the shared
    // "A-Reserved"/"Resident Reserved" category for filtering/night-rule
    // purposes. So this checks rawPermitList directly instead.
    if (isPerLotPermitCode(selectedPermit)) {
      const isVisible = Array.isArray(lot.rawPermitList) && lot.rawPermitList.includes(selectedPermit);
      return { ...lot, isVisible };
    }

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
        isVisible: lot.isVisible && lotMatchesPermitType(lot.permitList, user.parkingProfile.permitType, lot.rawPermitList),
      }))
    : filteredLots;

  // The PERMIT dropdown still reads "All Permits" while the preference above is
  // quietly narrowing the map underneath it — show the user's own permit type
  // instead so the label matches what's actually visible, until they've made
  // their own explicit choice.
  const permitDropdownLabel = getPermitDisplayLabel(
    filterByPermit && user.parkingProfile.permitType && selectedPermit === 'All Permits' && !permitManuallySelected
      ? user.parkingProfile.permitType
      : selectedPermit,
    permitOptions,
  );

  // null previewMode = follow the real clock.
  const previewingNight = previewMode === null ? actuallyNight : previewMode === 'night';
  const isLivePreview = previewingNight === actuallyNight;
  const dayNightActiveColor = isLivePreview ? '#00853E' : PREVIEW_AMBER_DARK;

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
            <Text style={styles.dropdownText} numberOfLines={1}>{permitDropdownLabel}</Text>
            <Ionicons name={openPermit ? "chevron-up" : "chevron-down"} size={27} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.liveStatusBar, !isLivePreview && styles.liveStatusBarPreview]}>
        <Ionicons
          name={isLivePreview ? 'time-outline' : (previewingNight ? 'moon' : 'sunny')}
          size={14}
          color={isLivePreview ? '#5d6d7e' : PREVIEW_AMBER_DARK}
        />
        <Text style={[styles.liveStatusText, !isLivePreview && styles.liveStatusTextPreview]}>
          {isLivePreview ? `Last synced: ${refreshLabel}` : `Previewing ${previewingNight ? 'Night' : 'Day'} rules`}
        </Text>
      </View>

      {/* THE MAP AREA */}
      <View style={styles.mapArea} pointerEvents={(openCampus || openPermit) ? "none" : "auto"}>
        <EagleMap
          liveLots={permitTypeFilteredLots}
          selectedCampus={selectedCampus}
          mapType={mapType}
        />
        <Animated.View
          style={[
            styles.hazardFabWrapper,
            { transform: [{ translateX: hazardShake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) }] },
          ]}
        >
          <TouchableOpacity
            style={styles.hazardFab}
            onPress={() => router.push('/report-options')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Report a hazard"
          >
            <Ionicons name="warning" size={34} color="#FACC15" />
          </TouchableOpacity>
        </Animated.View>

        {/* Single launcher for map settings (permit-rule preview + map type)
            instead of separate floating controls. Amber whenever previewing
            a time that doesn't match the real clock. */}
        <TouchableOpacity
          style={[styles.mapSettingsButton, !isLivePreview && styles.mapSettingsButtonPreview]}
          onPress={() => setMapSettingsOpen(!mapSettingsOpen)}
          accessibilityRole="button"
          accessibilityLabel="Map settings"
        >
          <Ionicons name="settings-outline" size={22} color={isLivePreview ? '#333' : PREVIEW_AMBER_DARK} />
        </TouchableOpacity>

        {mapSettingsOpen && (
          <View style={styles.mapSettingsPanel}>
            <Text style={styles.mapSettingsSectionLabel}>PERMIT RULES</Text>
            <View style={[styles.mapSettingsSegment, !isLivePreview && styles.mapSettingsSegmentPreview]}>
              <TouchableOpacity
                style={[styles.dayNightButton, !previewingNight && (isLivePreview ? styles.dayNightButtonActive : styles.dayNightButtonActivePreview)]}
                onPress={() => setPreviewMode('day')}
                accessibilityRole="button"
                accessibilityLabel="Preview daytime permit rules"
              >
                <Ionicons name="sunny" size={20} color={!previewingNight ? dayNightActiveColor : '#999'} />
                <Text style={styles.mapSettingsOptionText}>Day</Text>
              </TouchableOpacity>
              <View style={styles.dayNightDivider} />
              <TouchableOpacity
                style={[styles.dayNightButton, previewingNight && (isLivePreview ? styles.dayNightButtonActive : styles.dayNightButtonActivePreview)]}
                onPress={() => setPreviewMode('night')}
                accessibilityRole="button"
                accessibilityLabel="Preview nighttime permit rules"
              >
                <Ionicons name="moon" size={20} color={previewingNight ? dayNightActiveColor : '#999'} />
                <Text style={styles.mapSettingsOptionText}>Night</Text>
              </TouchableOpacity>
            </View>
            {!isLivePreview && <Text style={styles.mapSettingsPreviewNote}>Previewing — not live</Text>}

            <Text style={[styles.mapSettingsSectionLabel, { marginTop: 14 }]}>MAP VIEW</Text>
            <View style={styles.mapSettingsSegment}>
              <TouchableOpacity
                style={[styles.dayNightButton, mapType === 'standard' && styles.dayNightButtonActive]}
                onPress={() => setMapType('standard')}
                accessibilityRole="button"
                accessibilityLabel="Standard map view"
              >
                <Ionicons name="map-outline" size={20} color={mapType === 'standard' ? '#00853E' : '#999'} />
                <Text style={styles.mapSettingsOptionText}>Standard</Text>
              </TouchableOpacity>
              <View style={styles.dayNightDivider} />
              <TouchableOpacity
                style={[styles.dayNightButton, mapType === 'satellite' && styles.dayNightButtonActive]}
                onPress={() => setMapType('satellite')}
                accessibilityRole="button"
                accessibilityLabel="Satellite map view"
              >
                <Ionicons name="globe-outline" size={20} color={mapType === 'satellite' ? '#00853E' : '#999'} />
                <Text style={styles.mapSettingsOptionText}>Satellite</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
          data={[{ kind: 'all' } as const, ...permitOptions]}
          keyExtractor={(item) => (item.kind === 'all' ? 'All Permits' : item.kind === 'group' ? item.label : item.value)}
          nestedScrollEnabled
          showsVerticalScrollIndicator
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            if (item.kind === 'all') {
              return (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => { setSelectedPermit('All Permits'); setPermitManuallySelected(true); setOpenPermit(false); }}
                >
                  <Text style={styles.dropdownItemText}>All Permits</Text>
                </TouchableOpacity>
              );
            }
            if (item.kind === 'group') {
              const selectedSub = item.options.find((o) => o.value === selectedPermit);
              return (
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => { setOpenGroupLabel(item.label); setOpenPermit(false); }}
                >
                  <Text style={styles.dropdownItemText}>
                    {item.label}{selectedSub ? ` · ${selectedSub.label}` : ''}
                  </Text>
                </TouchableOpacity>
              );
            }
            return (
              <TouchableOpacity
                style={styles.dropdownItem}
                onPress={() => { setSelectedPermit(item.value); setPermitManuallySelected(true); setOpenPermit(false); }}
              >
                <Text style={styles.dropdownItemText}>{item.value}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal
        transparent
        animationType="slide"
        visible={openGroup !== undefined}
        onRequestClose={() => setOpenGroupLabel(null)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setOpenGroupLabel(null)}
        >
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Which {openGroup?.label} lot do you want to see?</Text>
            <Text style={styles.pickerSubtitle}>
              Pick a specific lot to show just that one, or &quot;{openGroup?.label}&quot;
              to show all of them.
            </Text>
            <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false}>
              {openGroup?.options.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.pickerOption}
                  onPress={() => {
                    setSelectedPermit(item.value);
                    setPermitManuallySelected(true);
                    setOpenGroupLabel(null);
                  }}
                >
                  <Text style={[styles.pickerOptionText, selectedPermit === item.value && styles.pickerOptionActive]}>
                    {item.label}
                  </Text>
                  {selectedPermit === item.value && <Ionicons name="checkmark" size={20} color="#00853E" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

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
  // Previewing a time-of-day other than right now — the sync timestamp
  // doesn't apply, so swap it for a note instead of implying stale data.
  liveStatusBarPreview: {
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
    borderBottomColor: PREVIEW_AMBER,
  },
  liveStatusText: {
    fontSize: 12,
    color: '#5d6d7e',
    fontWeight: '500',
  },
  liveStatusTextPreview: {
    color: PREVIEW_AMBER_DARK,
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
    flexShrink: 1,
    marginRight: 6,
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
  // Position lives on the wrapper so the shake animation's transform
  // doesn't fight with the button's own absolute placement.
  hazardFabWrapper: {
    position: 'absolute',
    right: 20,
    bottom: MAP_HAZARD_FAB_BOTTOM,
  },
  hazardFab: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#00853E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  // Same floating-card style as the map's own zoom controls, placed at the
  // opposite corner so the two don't compete.
  mapSettingsButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  // Previewing a time-of-day other than right now.
  mapSettingsButtonPreview: {
    backgroundColor: 'rgba(243, 156, 18, 0.15)',
    borderWidth: 1,
    borderColor: PREVIEW_AMBER,
  },
  mapSettingsPanel: {
    position: 'absolute',
    right: 16,
    top: 60,
    width: 220,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6,
  },
  mapSettingsSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  mapSettingsSegment: {
    flexDirection: 'row',
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    overflow: 'hidden',
  },
  mapSettingsSegmentPreview: {
    backgroundColor: 'rgba(243, 156, 18, 0.12)',
  },
  mapSettingsOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  mapSettingsPreviewNote: {
    fontSize: 11,
    color: PREVIEW_AMBER_DARK,
    marginTop: 6,
    fontWeight: '600',
  },
  dayNightButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
  },
  dayNightButtonActive: {
    backgroundColor: '#e8e8e8',
  },
  dayNightButtonActivePreview: {
    backgroundColor: 'rgba(243, 156, 18, 0.25)',
  },
  dayNightDivider: {
    width: 1,
    backgroundColor: '#ddd',
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

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Secondary lot picker for A-Reserved/Resident Reserved groups — same look
  // as Profile Setting's permit picker.
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  pickerSubtitle: {
    fontSize: 13,
    color: '#888',
    lineHeight: 18,
    marginBottom: 14,
  },
  pickerScroll: {
    maxHeight: 360,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerOptionText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  pickerOptionActive: {
    color: '#00853E',
    fontWeight: '700',
  },
});