import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { getAlerts, createAlert } from '../../api/alerts';
import { SafeAreaView} from 'react-native-safe-area-context';
import { Alert } from '../../utils/webCompat';

const getIconForCategory = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'gameday': return 'american-football';
    case 'tailgate': return 'flame';
    case 'concert': return 'musical-notes';
    case 'career': return 'briefcase';
    default: return 'calendar';
  }
};

// Matches the categories getIconForCategory() already knows how to draw an icon for.
const EVENT_CATEGORIES = ['Gameday', 'Tailgate', 'Concert', 'Career', 'Other'];
//backend stores timestamps in UTC without a "Z" suffix; append it before
//parsing so comparisons and displayed times use the device's local time
const parseUTC = (isoString: string) =>
  new Date(/Z$|[+-]\d{2}:?\d{2}$/.test(isoString) ? isoString : `${isoString}Z`);

const toLocalDateString = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayDateString = () => toLocalDateString(new Date());
export default function EventsScreen() {
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();
  const [selected, setSelected] = useState(getTodayDateString());
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const data = await getAlerts('event');
      setEvents(data);
    } catch (error) {
      Alert.alert("Error", "Could not load campus events.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);
  
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Lets the Profile tab's "Add New Event" action reuse this same modal instead
  // of duplicating the form, by deep-linking here with ?openAdd=1.
  useEffect(() => {
    if (openAdd) setShowAddEventModal(true);
  }, [openAdd]);

  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [startTimePeriod, setStartTimePeriod] = useState('AM');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [endTimePeriod, setEndTimePeriod] = useState('AM');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[Number(month) - 1] ?? '';
    return `${m} ${Number(day)}, ${year}`;
  };
  //Filter for ACTIVE events (selected LOCAL date or later, so nothing disappears)
  const activeEvents = events.filter(eventItem =>
    eventItem.created_at && toLocalDateString(parseUTC(eventItem.created_at)) >= selected
  );
  // ADD EVENT

  const handleSaveEvent = async () => {
    if (!eventName || !category || !startDate || !startTime || !endDate || !endTime) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }
    setIsSaving(true);
    try {
      //there's no dedicated start/end column on Alert, so the schedule is folded
      //into the description text instead of being silently dropped
      const schedule = `When: ${startDate} ${startTime} ${startTimePeriod} – ${endDate} ${endTime} ${endTimePeriod}`;
      const fullDescription = description.trim() ? `${schedule}\n\n${description.trim()}` : schedule;

      await createAlert({
        title: eventName.trim(),
        alert_type: 'event',
        category,
        description: fullDescription,
      });

      Alert.alert('Success', 'Event created successfully');
      setShowAddEventModal(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      Alert.alert('Error', 'Could not create the event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEventName('');
    setCategory(null);
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
    <SafeAreaView style={styles.mainContainer} edges={['right', 'left']}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.title}>Campus Events</Text>
        <Text style={styles.subtitle}>Select a date to view upcoming events</Text>

        <Calendar
          onDayPress={(day) => setSelected(day.dateString)}
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
          <View style={styles.feedContainer}>
            
            {/* --- SECTION 1: ACTIVE EVENTS --- */}
            <Text style={styles.feedTitle}>Events on {formatDate(selected)}</Text>
            
            {isLoading ? (
              <ActivityIndicator size="large" color="#00853E" style={{ marginTop: 20 }} />
            ) : activeEvents.length === 0 ? (
              <Text style={styles.emptyText}>No events scheduled for this date.</Text>
            ) : (
              activeEvents.map((eventItem) => (
                <TouchableOpacity 
                  key={eventItem.id} 
                  style={styles.card}
                  onPress={() => Alert.alert('Event Details', `Interested in this event? (ID: ${eventItem.id})`)}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.titleRow}>
                      <View style={styles.iconBox}>
                        <Ionicons name={getIconForCategory(eventItem.category)} size={24} color="#333" />
                      </View>
                      <Text style={styles.cardTitle}>{eventItem.title}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{eventItem.upvotes}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardTime}>
                    {parseUTC(eventItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {eventItem.description && (
                     <Text style={styles.cardDesc}>{eventItem.description}</Text>
                  )}
                  <Text style={styles.clickDetails}>CLICK FOR DETAILS</Text>
                </TouchableOpacity>
              ))
            )}

          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddEventModal(true)}
        accessibilityLabel="Add Event"
      >
        <View style={styles.fabContent}>
          <Ionicons name="add" size={24} color="#fff" />
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
              <TouchableOpacity style={styles.modalBackButton} onPress={handleCancel} disabled={isSaving}>
                <Ionicons name="chevron-back" size={20} color="#00853E" />
                <Text style={styles.modalBackText}>Back</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add Event</Text>

              <Text style={styles.fieldLabel}>Enter Event Name:</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Event name"
                value={eventName}
                onChangeText={setEventName}
                placeholderTextColor="#999"
              />

              <Text style={styles.fieldLabel}>Category:</Text>
              <View style={styles.categoryRow}>
                {EVENT_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.categoryButton, category === c && styles.categoryButtonActive]}
                    onPress={() => setCategory(c)}
                  >
                    <Text style={[styles.categoryButtonText, category === c && styles.categoryButtonTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

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
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={isSaving}>
                  <Text style={styles.cancelButtonText}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                  onPress={handleSaveEvent}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>SAVE</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContainer: { flex: 1, padding: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#00853E', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  
  feedContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#00853E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  feedTitle: { fontSize: 18, fontWeight: 'bold', color: '#00853E', marginBottom: 16 },
  emptyText: { fontSize: 14, color: '#666', fontStyle: 'italic', marginBottom: 8 },
  
  card: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    backgroundColor: '#e8f5ee',
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#1a1a1a', flexShrink: 1 },
  badge: {
    backgroundColor: '#E74C3C',
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -8,
    right: -8,
    borderWidth: 2,
    borderColor: '#f5f5f5',
    zIndex: 1,
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  cardTime: { fontSize: 12, color: '#555', marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' },
  cardDesc: { fontSize: 14, color: '#444', marginBottom: 12, lineHeight: 20 },
  clickDetails: { fontSize: 10, color: '#999', fontStyle: 'italic', textAlign: 'right', fontWeight: 'bold' },

  pastEventsWrapper: { marginTop: 8 },
  divider: { height: 1, backgroundColor: '#ddd', marginBottom: 16 },
  pastFeedTitle: { fontSize: 16, fontWeight: 'bold', color: '#888', marginBottom: 12, textTransform: 'uppercase' },
  outdatedCard: {
    backgroundColor: '#f9f9f9',
    borderColor: '#eee',
    borderWidth: 1,
    opacity: 0.65,
    padding: 12,
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
  outdatedIconBox: { backgroundColor: '#e0e0e0' },
  outdatedText: { color: '#888' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    backgroundColor: '#00853E',
    paddingHorizontal: 20,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  fabContent: { flexDirection: 'row', alignItems: 'center' },
  fabText: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    height: '100%',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#00853E',
    marginBottom: 4,
    textAlign: 'center',
  },
  modalBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    marginBottom: 16,
  },
  modalBackText: {
    color: '#00853E',
    fontSize: 16,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  textInput: {
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    color: '#333',
    marginBottom: 16,
  },
  descriptionInput: {
    height: 140,
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
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
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
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  categoryButtonActive: {
    backgroundColor: '#00853E',
    borderColor: '#00853E',
  },
  categoryButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  categoryButtonTextActive: {
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
    paddingVertical: 14,
    marginRight: 8,
    backgroundColor: '#E8E8E8',
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#666',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    marginLeft: 8,
    backgroundColor: '#00853E',
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#fff',
  },
});