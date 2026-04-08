import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

// Top Bar
function TopBar() {
  const router = useRouter();
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
        <TouchableOpacity style={styles.bellWrapper} onPress={() => router.push('/(tabs)/alerts')}>
          <Ionicons name="notifications-outline" size={28} color="#333" />
        </TouchableOpacity>
      </View>

    </View>
  );
}

// Map Screen
export default function MapScreen() {
  const [selectedCampus, setSelectedCampus] = React.useState("Main campus");
  const [openCampus, setOpenCampus] = React.useState(false);

  const [selectedPermit, setSelectedPermit] = React.useState("Eagle");
  const [openPermit, setOpenPermit] = React.useState(false);

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

      {/* CAPACITY INDICATOR — NOW AT THE BOTTOM */}
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

      {/* Placeholder content */}
      <View style={styles.content}>
        <Text style={styles.title}>EagleEyes Map</Text>
        <Text style={styles.subtitle}>UNT Parking map will go here!</Text>
      </View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#f9f9f9' },
  content:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:      { fontSize: 32, fontWeight: 'bold', color: '#00853E', marginBottom: 10 },
  subtitle:   { fontSize: 16, color: '#666' },

  // Top Bar
  topBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#eee' },
  topBarSide:  { width: 50, justifyContent: 'center' },
  bellWrapper: { alignItems: 'flex-end' },
  logo:        { width: 100, height: 55, resizeMode: 'contain' },
  appName:     { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#00853E' },

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
