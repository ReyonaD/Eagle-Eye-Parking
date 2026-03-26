import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function LotsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Parking Lots</Text>
      <Text style={styles.subtitle}>List of UNT lots will go here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#00853E', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666' }
});