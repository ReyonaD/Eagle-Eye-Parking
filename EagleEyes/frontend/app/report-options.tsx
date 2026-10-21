import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReportOptionsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.handle} />
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color="#00853E" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Add a Report</Text>

        <View style={styles.choices}>
          <TouchableOpacity
            style={styles.choice}
            onPress={() => router.replace('/report-hazard')}
            activeOpacity={0.75}
          >
            <View style={styles.circleButton}>
              <Ionicons name="warning-outline" size={40} color="#E3A008" />
            </View>
            <Text style={styles.choiceText}>Report a Hazard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.choice}
            onPress={() => router.replace('/report-note')}
            activeOpacity={0.75}
          >
            <View style={styles.circleButton}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color="#3976B9" />
            </View>
            <Text style={styles.choiceText}>Note to Admin</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(20, 28, 32, 0.32)',
  },
  sheet: {
    height: '32%',
    minHeight: 280,
    maxHeight: 300,
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  handle: {
    width: 38,
    height: 4,
    alignSelf: 'center',
    borderRadius: 2,
    backgroundColor: '#C9CED2',
    marginBottom: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginTop: 8,
    marginBottom: 4,
  },
  backText: {
    color: '#00853E',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#00853E',
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },
  choices: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
  },
  circleButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.95,
    borderColor: '#00853E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    maxWidth: 140,
    color: '#30363B',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});