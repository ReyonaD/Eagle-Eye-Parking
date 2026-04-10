import React, { useState } from 'react';

import {
  View,
  Text,
  TouchableOpacity, 
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';


type NavTab = "map" | "lots" | "profile";

const C = {
  green : "#00853E",
  surface: "#F5F5F5",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  bg: "#F4F6F5",
} as const;

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: 18,
    fontWeight: '700',
    color: C.text,
  },
  bellButton: {
    padding: 8,
  },
  bellIcon: {
    fontSize: 20,
  },
});

//Top Bar
const TopBar: React.FC =() => (
  <View style={styles.topBar}>
    {/*Logo + Name*/}
    <View style={styles.brand}>
      <Image
        source={require('../assets/images/EagleEyeLogo.png')}
        style={styles.brandLogo}
        resizeMode="contain"
      />
      <Text style={styles.brandName}>EagleEyes</Text>
    </View>
    {/* Bell icon */}
    <TouchableOpacity style={styles.bellButton} onPress={() => {}}>
      <Text style={styles.bellIcon}>🔔</Text>
    </TouchableOpacity>
  </View>
);