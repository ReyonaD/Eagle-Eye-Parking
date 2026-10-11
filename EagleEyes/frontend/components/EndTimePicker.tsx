import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePickerModal from './DatePickerModal';
import TimePickerField, { Period } from './TimePickerField';

export type { Period };

export type EndTimeMode = '24hr' | 'endOfDay' | 'overnight' | 'custom';

export interface EndTimeValue {
  mode: EndTimeMode;
  //"YYYY-MM-DD" from the calendar picker, or '' if not yet picked
  customDate: string;
  customTime: string;
  customPeriod: Period;
}

export const DEFAULT_END_TIME: EndTimeValue = {
  mode: '24hr',
  customDate: '',
  customTime: '',
  customPeriod: 'AM',
};

const MODE_OPTIONS: { value: EndTimeMode; label: string }[] = [
  { value: '24hr', label: '24hr' },
  { value: 'endOfDay', label: 'End of day' },
  { value: 'overnight', label: 'Overnight' },
  { value: 'custom', label: 'Custom' },
];

//"YYYY-MM-DD" -> "Mon D, YYYY"
function formatDateDisplay(dateString: string): string {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[Number(month) - 1] ?? '';
  return `${m} ${Number(day)}, ${year}`;
}

export function isValidTimeHHMM(value: string): boolean {
  return /^(0?[1-9]|1[0-2]):([0-5]\d)$/.test(value.trim());
}

//the date now always comes from the calendar picker, so it's valid whenever
//it's non-empty - only the typed time portion can still be malformed
export function isEndTimeValid(value: EndTimeValue): boolean {
  if (value.mode !== 'custom') return true;
  return !!value.customDate && isValidTimeHHMM(value.customTime);
}

interface EndTimePickerProps {
  value: EndTimeValue;
  onChange: (value: EndTimeValue) => void;
}

// 4-mode End Time selector from DDS2's Note to Admin wireframe (24hr / End of
// day / Overnight / Custom). Always resolves to a concrete end - unlike admin
// events, a note needs an estimated end so admins can track when it expires. Custom reveals a date button (opens the same
// mini calendar used elsewhere in the app) plus a typed time + AM/PM toggle.
export default function EndTimePicker({ value, onChange }: EndTimePickerProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const setMode = (mode: EndTimeMode) => onChange({ ...value, mode });

  return (
    <View>
      <View style={styles.modeRow}>
        {MODE_OPTIONS.map((option) => {
          const selected = value.mode === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.modeChip, selected && styles.modeChipSelected]}
              onPress={() => setMode(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modeChipText, selected && styles.modeChipTextSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {value.mode === 'custom' && (
        <View style={styles.customWrap}>
          <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={16} color={value.customDate ? '#00853E' : '#888'} />
            <Text style={[styles.dateButtonText, value.customDate && styles.dateButtonTextFilled]}>
              {value.customDate ? formatDateDisplay(value.customDate) : 'SELECT END DATE'}
            </Text>
          </TouchableOpacity>
          <TimePickerField
            time={value.customTime}
            period={value.customPeriod}
            onChange={(customTime, customPeriod) => onChange({ ...value, customTime, customPeriod })}
            placeholder="SELECT END TIME"
            title="End time"
          />

          <DatePickerModal
            visible={showDatePicker}
            onClose={() => setShowDatePicker(false)}
            onSelect={(dateString) => onChange({ ...value, customDate: dateString })}
            initialDate={value.customDate || undefined}
            title="Select end date"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  modeChipSelected: {
    backgroundColor: '#00853E',
  },
  modeChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  modeChipTextSelected: {
    color: '#fff',
  },
  customWrap: {
    marginTop: 10,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  dateButtonTextFilled: {
    color: '#333',
  },
});
