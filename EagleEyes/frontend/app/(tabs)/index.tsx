import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';


function MapPlaceholder() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>EagleEyes Map</Text>
      <Text style={styles.subtitle}>UNT Parking map will go here!</Text>
    </View>
  );
}

function LotsPlaceholder() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Lots</Text>
      <Text style={styles.subtitle}>UNT Parking lots will go here!</Text>
    </View>
  );
}

function ProfilePlaceholder() {
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.subtitle}>User profile will go here!</Text>
    </View>
  );
}


const TABS = [
  { key: 'map',     label: 'Map',     icon: 'map',    component: MapPlaceholder     },
  { key: 'lots',    label: 'Lots',    icon: 'car',    component: LotsPlaceholder    },
  { key: 'profile', label: 'Profile', icon: 'person', component: ProfilePlaceholder },
];

//Map Screen
export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState('map');

  const ActiveScreen = TABS.find(t => t.key === activeTab)?.component ?? MapPlaceholder;

  return (
    <View style={styles.container}>
      {/* Page Content */}
      <View style={styles.content}>
        <ActiveScreen />
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Color UNT Branding
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f9f9f9' },
  content:         { flex: 1 },

  // Placeholder screens
  screen:          { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:           { fontSize: 32, fontWeight: 'bold', color: '#00853E', marginBottom: 10 },
  subtitle:        { fontSize: 16, color: '#666' },

  // Tab bar
  tabBar:          { flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#ddd', height: 80 },
  tabItem:         { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabLabel:        { fontSize: 14, color: '#999' },
  tabLabelActive:  { color: '#00853E', fontWeight: 'bold' },
  tabIndicator:    { position: 'absolute', bottom: 0, height: 3, width: '60%', backgroundColor: '#00853E', borderRadius: 2 },
});