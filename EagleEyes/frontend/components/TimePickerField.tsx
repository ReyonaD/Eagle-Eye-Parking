import React, { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type Period = 'AM' | 'PM';

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const PERIODS: Period[] = ['AM', 'PM'];
const ROW_HEIGHT = 44;

// One-tap picks for the times people reach for most.
const PRESETS: { label: string; hour: number; minute: number; period: Period }[] = [
  { label: 'Morning · 8:00 AM', hour: 8, minute: 0, period: 'AM' },
  { label: 'Noon · 12:00 PM', hour: 12, minute: 0, period: 'PM' },
  { label: 'Afternoon · 3:00 PM', hour: 3, minute: 0, period: 'PM' },
  { label: 'Evening · 6:00 PM', hour: 6, minute: 0, period: 'PM' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');

//"H:MM" -> { hour, minute }, or null when empty/malformed
function parseTime(time: string): { hour: number; minute: number } | null {
  const m = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

// The current time rounded up to the next 5 minutes - a sensible starting
// point when nothing has been picked yet.
function roundedNow(): { hour: number; minute: number; period: Period } {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const h24 = d.getHours();
  return { hour: h24 % 12 || 12, minute: d.getMinutes(), period: h24 >= 12 ? 'PM' : 'AM' };
}

function Column<T extends string | number>({
  label,
  items,
  selected,
  format,
  onSelect,
  visible,
}: {
  label: string;
  items: T[];
  selected: T;
  format: (item: T) => string;
  onSelect: (item: T) => void;
  visible: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);

  // Scroll the current value into the middle of the column when opened.
  useEffect(() => {
    if (!visible) return;
    const index = Math.max(0, items.indexOf(selected));
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (index - 1) * ROW_HEIGHT), animated: false });
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView ref={scrollRef} style={styles.columnScroll} showsVerticalScrollIndicator={false}>
        {items.map((item) => {
          const active = item === selected;
          return (
            <TouchableOpacity
              key={String(item)}
              style={[styles.option, active && styles.optionActive]}
              onPress={() => onSelect(item)}
            >
              <Text style={[styles.optionText, active && styles.optionTextActive]}>{format(item)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// Tap-to-pick time field: shows the chosen time like the app's date buttons,
// and opens a popup with quick presets plus hour / minute / AM-PM columns -
// no typing "HH:MM". Value stays the same "H:MM" + AM/PM pair the forms
// already validate and convert.
export default function TimePickerField({
  time,
  period,
  onChange,
  placeholder = 'SELECT TIME',
  title = 'Select a time',
}: {
  time: string;
  period: Period | string;
  onChange: (time: string, period: Period) => void;
  placeholder?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(roundedNow());

  const parsed = parseTime(time);
  const display = parsed ? `${parsed.hour}:${pad2(parsed.minute)} ${period}` : '';

  const openPicker = () => {
    setDraft(parsed ? { ...parsed, period: (period as Period) || 'AM' } : roundedNow());
    setOpen(true);
  };

  const commit = (value: { hour: number; minute: number; period: Period }) => {
    onChange(`${value.hour}:${pad2(value.minute)}`, value.period);
    setOpen(false);
  };

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={openPicker} accessibilityRole="button" accessibilityLabel={title}>
        <Ionicons name="time-outline" size={18} color={display ? '#00853E' : '#999'} />
        <Text style={[styles.fieldText, !!display && styles.fieldTextFilled]}>{display || placeholder}</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#555" />
              </TouchableOpacity>
            </View>

            <View style={styles.presetRow}>
              {PRESETS.map((preset) => (
                <TouchableOpacity key={preset.label} style={styles.preset} onPress={() => commit(preset)}>
                  <Text style={styles.presetText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.columns}>
              <Column
                label="Hour"
                items={HOURS}
                selected={draft.hour}
                format={String}
                onSelect={(hour) => setDraft({ ...draft, hour })}
                visible={open}
              />
              <Column
                label="Minute"
                items={MINUTES}
                selected={MINUTES.includes(draft.minute) ? draft.minute : Math.floor(draft.minute / 5) * 5}
                format={pad2}
                onSelect={(minute) => setDraft({ ...draft, minute })}
                visible={open}
              />
              <Column
                label=" "
                items={PERIODS}
                selected={draft.period}
                format={String}
                onSelect={(p) => setDraft({ ...draft, period: p })}
                visible={open}
              />
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={() => commit(draft)}>
              <Text style={styles.doneText}>
                Set {draft.hour}:{pad2(draft.minute)} {draft.period}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Matches the date buttons on the event and note forms
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  fieldText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  fieldTextFilled: {
    color: '#333',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00853E',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#E8F5EE',
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00853E',
  },
  columns: {
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    textAlign: 'center',
    marginBottom: 4,
  },
  columnScroll: {
    height: ROW_HEIGHT * 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  option: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  optionActive: {
    backgroundColor: '#00853E',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
  },
  optionTextActive: {
    color: '#fff',
  },
  doneButton: {
    marginTop: 14,
    backgroundColor: '#00853E',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
