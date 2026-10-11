import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';

//shared mini date-picker used anywhere a screen needs a start/end date
//(campus events, notes to admin, ...) instead of a free-text date field
export default function DatePickerModal({
  visible,
  onClose,
  onSelect,
  initialDate,
  title = 'Select a date',
  minDate,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (dateString: string) => void;
  initialDate?: string;
  title?: string;
  minDate?: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#555" />
            </TouchableOpacity>
          </View>
          <Calendar
            current={initialDate || undefined}
            minDate={minDate}
            markedDates={
              initialDate
                ? { [initialDate]: { selected: true, selectedColor: '#00853E' } }
                : {}
            }
            onDayPress={(day: DateData) => {
              onSelect(day.dateString);
              onClose();
            }}
            theme={{
              backgroundColor: '#fff',
              calendarBackground: '#fff',
              textSectionTitleColor: '#00853E',
              selectedDayBackgroundColor: '#00853E',
              selectedDayTextColor: '#fff',
              todayTextColor: '#00853E',
              dayTextColor: '#333',
              monthTextColor: '#00853E',
              arrowColor: '#00853E',
            }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    paddingBottom: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
});
