import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPermitCardStyle } from '../utils/permitColors';
import PermitHoursList from './PermitHoursList';

//permit chips shown before "Show all"; some lots (e.g. Frisco) list 40+ permits
const COLLAPSED_COUNT = 12;

//a lot's permit chips plus their hours. Long lists start collapsed so the card stays short
export default function LotPermits({ permits, title = 'Permits', titleStyle }: {
  permits: string[];
  title?: string;
  titleStyle?: any;
}) {
  const [showAll, setShowAll] = useState(false);
  const [showHours, setShowHours] = useState(false);
  if (permits.length === 0) return null;

  const isLong = permits.length > COLLAPSED_COUNT;
  const visible = isLong && !showAll ? permits.slice(0, COLLAPSED_COUNT) : permits;

  return (
    <View>
      <Text style={[styles.title, titleStyle]}>{title} ({permits.length})</Text>
      <View style={styles.chips}>
        {visible.map((label) => {
          const permitStyle = getPermitCardStyle(label);
          return (
            <View
              key={label}
              style={[
                styles.chip,
                { backgroundColor: permitStyle.bg },
                permitStyle.border ? { borderWidth: 1, borderColor: permitStyle.border } : null,
              ]}
            >
              <Text style={[styles.chipText, { color: permitStyle.text }]}>{label}</Text>
            </View>
          );
        })}
        {isLong && (
          <TouchableOpacity style={styles.moreChip} onPress={() => setShowAll(!showAll)}>
            <Text style={styles.moreText}>
              {showAll ? 'Show less' : `+${permits.length - COLLAPSED_COUNT} more`}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* hours for many permits get long too, so they're one tap away instead of always open */}
      {isLong ? (
        <>
          <TouchableOpacity style={styles.hoursToggle} onPress={() => setShowHours(!showHours)}>
            <Ionicons name="time-outline" size={16} color="#00853E" />
            <Text style={styles.hoursToggleText}>{showHours ? 'Hide permit hours' : 'Show permit hours'}</Text>
            <Ionicons name={showHours ? 'chevron-up' : 'chevron-down'} size={16} color="#00853E" />
          </TouchableOpacity>
          {showHours && <PermitHoursList permits={permits} />}
        </>
      ) : (
        <PermitHoursList permits={permits} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 14, color: '#777', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  chipText: { fontSize: 12, fontWeight: '500' },
  moreChip: {
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#00853E', backgroundColor: '#fff',
  },
  moreText: { fontSize: 12, fontWeight: '700', color: '#00853E' },
  hoursToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 4 },
  hoursToggleText: { fontSize: 13, fontWeight: '700', color: '#00853E' },
});
