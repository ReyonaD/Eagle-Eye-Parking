import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePickerModal from './DatePickerModal';

export type EndTimeMode = '24hr' | 'endOfDay' | 'overnight' | 'custom';
export type Period = 'AM' | 'PM';

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

// Strips non-digits, caps at 4, inserts ":" after the first 2 (e.g. "0932" -> "09:32")
export function formatTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
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
// day / Overnight / Custom). Custom reveals a date button (opens the same
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
          <View style={styles.timeRow}>
            <TextInput
              style={[styles.customDateInput, styles.timeInput]}
              placeholder="--:--"
              placeholderTextColor="#888"
              value={value.customTime}
              onChangeText={(text) => onChange({ ...value, customTime: formatTimeInput(text) })}
              keyboardType="number-pad"
              maxLength={5}
            />
            <TouchableOpacity
              style={[styles.periodButton, value.customPeriod === 'AM' && styles.periodButtonActive]}
              onPress={() => onChange({ ...value, customPeriod: 'AM' })}
            >
              <Text style={[styles.periodButtonText, value.customPeriod === 'AM' && styles.periodButtonTextActive]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.periodButton, value.customPeriod === 'PM' && styles.periodButtonActive]}
              onPress={() => onChange({ ...value, customPeriod: 'PM' })}
            >
              <Text style={[styles.periodButtonText, value.customPeriod === 'PM' && styles.periodButtonTextActive]}>PM</Text>
            </TouchableOpacity>
          </View>

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
  // Mirrors app/(admin)/events.tsx's textInput style
  customDateInput: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 14,
    fontSize: 14,
    color: '#333',
    marginBottom: 10,
  },
  // Mirrors app/(admin)/events.tsx's timeRow/timeInput/periodButton* styles
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeInput: {
    flex: 1,
    marginRight: 8,
    marginBottom: 0,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    marginRight: 6,
  },
  periodButtonActive: {
    backgroundColor: '#00853E',
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
});
