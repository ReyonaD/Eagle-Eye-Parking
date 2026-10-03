import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export type EndTimeMode = '24hr' | 'endOfDay' | 'overnight' | 'custom';
export type Period = 'AM' | 'PM';

export interface EndTimeValue {
  mode: EndTimeMode;
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

// Reusable digit-group auto-formatter: strips non-digits, caps at 4 digits,
// and inserts `separator` after the first 2 (e.g. "1002" -> "10/02"). Shared
// by both the date (MM/DD) and time (HH:MM) inputs, start and custom end time.
function formatDigitPair(raw: string, separator: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}${separator}${digits.slice(2)}`;
}

export function formatDateInput(raw: string): string {
  return formatDigitPair(raw, '/');
}

export function formatTimeInput(raw: string): string {
  return formatDigitPair(raw, ':');
}

// Lightweight format checks only — not full calendar validation (no leap-year/
// days-in-month math). Just enough to catch obviously malformed input like "01/02"
// being accepted as a complete start/end time.
export function isValidDateMMDD(value: string): boolean {
  return /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])$/.test(value.trim());
}

export function isValidTimeHHMM(value: string): boolean {
  return /^(0?[1-9]|1[0-2]):([0-5]\d)$/.test(value.trim());
}

export function isEndTimeValid(value: EndTimeValue): boolean {
  if (value.mode !== 'custom') return true;
  return isValidDateMMDD(value.customDate) && isValidTimeHHMM(value.customTime);
}

// For Start Time's single combined date+time field (AM/PM is a separate
// controlled toggle, not part of this string) — reuses the same date/time
// formatters above, just chained: first 4 digits -> date, next up to 4 -> time.
export function formatStartDateTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const dateDigits = digits.slice(0, 4);
  const timeDigits = digits.slice(4, 8);
  let result = formatDateInput(dateDigits);
  if (timeDigits.length > 0) {
    result += ` ${formatTimeInput(timeDigits)}`;
  }
  return result;
}

export function isValidStartDateTime(value: string): boolean {
  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2) return false;
  return isValidDateMMDD(parts[0]) && isValidTimeHHMM(parts[1]);
}

interface EndTimePickerProps {
  value: EndTimeValue;
  onChange: (value: EndTimeValue) => void;
}

// 4-mode End Time selector from DDS2's Note to Admin wireframe (24hr / End of
// day / Overnight / Custom), with Custom revealing its own Date + Time + AM/PM
// inputs — mirroring the existing Start/End date-time pattern already used in
// app/(admin)/events.tsx (separate date field, separate time field, AM/PM as a
// controlled toggle rather than typed text).
export default function EndTimePicker({ value, onChange }: EndTimePickerProps) {
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
          <TextInput
            style={styles.customDateInput}
            placeholder="MM/DD"
            placeholderTextColor="#888"
            value={value.customDate}
            onChangeText={(text) => onChange({ ...value, customDate: formatDateInput(text) })}
            keyboardType="number-pad"
            maxLength={5}
          />
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
