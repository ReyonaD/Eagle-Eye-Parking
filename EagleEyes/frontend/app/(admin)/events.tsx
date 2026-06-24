import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

export default function HazardsScreen() {
  const [selected, setSelected] = useState('');
  
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventName, setEventName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [startTimePeriod, setStartTimePeriod] = useState('AM');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [endTimePeriod, setEndTimePeriod] = useState('AM');
  const [description, setDescription] = useState('');

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[Number(month) - 1] ?? '';
    return `${m} ${Number(day)}, ${year}`;
  };

  // ADD EVENT 

  const handleSaveEvent = () => {
    if (!eventName || !startDate || !startTime || !endDate || !endTime) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }
    Alert.alert('Success', 'Event created successfully');
    setShowAddEventModal(false);
    resetForm();
  };

  const resetForm = () => {
    setEventName('');
    setStartDate('');
    setStartTime('');
    setStartTimePeriod('AM');
    setEndDate('');
    setEndTime('');
    setEndTimePeriod('AM');
    setDescription('');
  };

  const handleCancel = () => {
    setShowAddEventModal(false);
    resetForm();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Hazards Reports</Text>
        <Text style={styles.subtitle}>Select a date to view hazard reports</Text>

        <Calendar
          onDayPress={(day) => {
            setSelected(day.dateString);
          }}
          markedDates={{
            [selected]: {
              selected: true,
              disableTouchEvent: true,
              selectedColor: '#00853E',
            },
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

        {selected && (
          <View style={styles.eventsDateContainer}>
            <Text style={styles.eventsDate}>Events on {formatDate(selected)}</Text>
            <Text style={styles.subtitle}>No events scheduled for this date.</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddEventModal(true)}
        accessibilityLabel="Add Event"
      >
        <View style={styles.fabContent}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.fabText}>Add Event</Text>
        </View>
      </TouchableOpacity>

      {/* Add Event Modal */}
      <Modal
        visible={showAddEventModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Add Event</Text>

              <Text style={styles.fieldLabel}>Enter Event Name:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Event name"
                value={eventName}
                onChangeText={setEventName}
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Start date:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="MM/DD/YYYY"
                value={startDate}
                onChangeText={setStartDate}
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Start time:</Text>
              <View style={styles.timeRow}>
                <TextInput
                  style={[styles.textInput, styles.timeInput]}
                  placeholder="--:--"
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={[styles.periodButton, startTimePeriod === 'AM' && styles.periodButtonActive]}
                  onPress={() => setStartTimePeriod('AM')}
                >
                  <Text style={[styles.periodButtonText, startTimePeriod === 'AM' && styles.periodButtonTextActive]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodButton, startTimePeriod === 'PM' && styles.periodButtonActive]}
                  onPress={() => setStartTimePeriod('PM')}
                >
                  <Text style={[styles.periodButtonText, startTimePeriod === 'PM' && styles.periodButtonTextActive]}>PM</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>End date:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="MM/DD/YYYY"
                value={endDate}
                onChangeText={setEndDate}
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>End time:</Text>
              <View style={styles.timeRow}>
                <TextInput
                  style={[styles.textInput, styles.timeInput]}
                  placeholder="--:-"
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  style={[styles.periodButton, endTimePeriod === 'AM' && styles.periodButtonActive]}
                  onPress={() => setEndTimePeriod('AM')}
                >
                  <Text style={[styles.periodButtonText, endTimePeriod === 'AM' && styles.periodButtonTextActive]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.periodButton, endTimePeriod === 'PM' && styles.periodButtonActive]}
                  onPress={() => setEndTimePeriod('PM')}
                >
                  <Text style={[styles.periodButtonText, endTimePeriod === 'PM' && styles.periodButtonTextActive]}>PM</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Description:</Text>
              <TextInput
                style={[styles.textInput, styles.descriptionInput]}
                placeholder="Event description"
                value={description}
                onChangeText={setDescription}
                multiline={true}
                numberOfLines={4}
                placeholderTextColor="#999"
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveEvent}>
                  <Text style={styles.saveButtonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00853E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  selectedDateContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00853E',
  },
  eventsDateContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#00853E',
  },
  eventsDate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00853E',
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#00853E',
    paddingHorizontal: 14,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fabText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00853E',
    marginBottom: 20,
    textAlign: 'center',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timeInput: {
    flex: 1,
    marginRight: 8,
  },
  periodButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
    marginRight: 6,
  },
  periodButtonActive: {
    backgroundColor: '#00853E',
    borderColor: '#00853E',
  },
  periodButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  periodButtonTextActive: {
    color: '#fff',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    backgroundColor: '#00853E',
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});