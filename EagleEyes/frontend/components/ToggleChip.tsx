import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// On/off pill used for the "All day" / "No end date" switches on the event and
// note forms - same green-when-selected look as EndTimePicker's mode chips.
export default function ToggleChip({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, value && styles.chipSelected]}
      onPress={() => onChange(!value)}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
    >
      <Ionicons name={value ? 'checkbox' : 'square-outline'} size={16} color={value ? '#fff' : '#555'} />
      <Text style={[styles.chipText, value && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  chipSelected: {
    backgroundColor: '#00853E',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  chipTextSelected: {
    color: '#fff',
  },
});
