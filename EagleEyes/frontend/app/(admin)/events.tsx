import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { getAlerts, createAlert, deleteAlert } from '../../api/alerts';
import { SafeAreaView} from 'react-native-safe-area-context';
import { Alert } from '../../utils/webCompat';
import { getEventVisual, EVENT_CATEGORIES } from '../../utils/alertVisuals';
import { useLots } from '../../context/LotsContext';
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
const NUMBERED_LOTS = Array.from({ length: 99 }, (_, index) => `Lot ${String(index + 1).padStart(2, '0')}`);

const getEventDateKeys = (eventItem: any): string[] => {
  const scheduleMatch = /^When:\s*(\d{2})\/(\d{2})\/(\d{4}).*?[–-]\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(
    String(eventItem.description || ''),
  );

  if (!scheduleMatch) {
    return eventItem.created_at ? [toLocalDateString(parseUTC(eventItem.created_at))] : [];
  }

  const [, startMonth, startDay, startYear, endMonth, endDay, endYear] = scheduleMatch;
  const startKey = `${startYear}-${startMonth}-${startDay}`;
  const endKey = `${endYear}-${endMonth}-${endDay}`;
  const start = new Date(`${startKey}T00:00:00Z`);
  const end = new Date(`${endKey}T00:00:00Z`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start.toISOString().slice(0, 10) !== startKey ||
    end.toISOString().slice(0, 10) !== endKey ||
    start > end
  ) {
    return [];
  }

  const dates: string[] = [];
  for (const date = new Date(start); date <= end; date.setUTCDate(date.getUTCDate() + 1)) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
};

const formatDateInput = (value: string, previousValue: string) => {
  if (value.length < previousValue.length && previousValue.endsWith('/') && value === previousValue.slice(0, -1)) {
    return value;
  }

  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length < 2) return digits;
  if (digits.length === 2) return `${digits}/`;
  if (digits.length < 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  if (digits.length === 4) return `${digits.slice(0, 2)}/${digits.slice(2)}/`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const formatTimeInput = (value: string, previousValue: string) => {
  if (value.length < previousValue.length && previousValue.endsWith(':') && value === previousValue.slice(0, -1)) {
    return value;
  }

  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length < 2) return digits;
  if (digits.length === 2) return `${digits}:`;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

export default function EventsScreen() {
  const { lots: backendLots } = useLots();
  const { openAdd } = useLocalSearchParams<{ openAdd?: string }>();
  const [selected, setSelected] = useState(getTodayDateString());
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

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
  const [otherCategory, setOtherCategory] = useState('');
  const [selectedLot, setSelectedLot] = useState('');
  const [isLotPickerOpen, setIsLotPickerOpen] = useState(false);
  const [lotSearch, setLotSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [datePickerFor, setDatePickerFor] = useState<'start' | 'end' | null>(null);
  const [startTime, setStartTime] = useState('');
  const [startTimePeriod, setStartTimePeriod] = useState('AM');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [endTimePeriod, setEndTimePeriod] = useState('AM');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const lotOptions = useMemo(() => {
    const backendLotNames = backendLots
      .map((lot: any) => String(lot.name || lot.lot_name || '').trim())
      .filter(Boolean);
    return [...new Set([...NUMBERED_LOTS, ...backendLotNames])];
  }, [backendLots]);
  const filteredLotOptions = lotOptions.filter((lotName) =>
    lotName.toLowerCase().includes(lotSearch.trim().toLowerCase()),
  );

  const renderDateCalendar = (field: 'start' | 'end', dateValue: string) => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateValue);
    const calendarDate = match ? `${match[3]}-${match[1]}-${match[2]}` : getTodayDateString();

    return (
      <View style={styles.dateCalendar}>
        <Calendar
          current={calendarDate}
          onDayPress={({ dateString }) => {
            const [year, month, day] = dateString.split('-');
            const formattedDate = `${month}/${day}/${year}`;
            if (field === 'start') setStartDate(formattedDate);
            else setEndDate(formattedDate);
            setDatePickerFor(null);
          }}
          markedDates={{
            [calendarDate]: { selected: true, selectedColor: '#00853E' },
          }}
          theme={{
            textSectionTitleColor: '#00853E',
            selectedDayBackgroundColor: '#00853E',
            selectedDayTextColor: '#fff',
            todayTextColor: '#00853E',
            dayTextColor: '#333',
            monthTextColor: '#00853E',
            arrowColor: '#00853E',
          }}
        />
      </View>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[Number(month) - 1] ?? '';
    return `${m} ${Number(day)}, ${year}`;
  };
  const activeEvents = events.filter((eventItem) => getEventDateKeys(eventItem).includes(selected));
  const eventDateMarks: Record<string, { marked: true; dotColor: string }> = {};
  events.forEach((eventItem) => {
    getEventDateKeys(eventItem).forEach((date) => {
      eventDateMarks[date] = { marked: true, dotColor: '#00853E' };
    });
  });
  const calendarMarkedDates = {
    ...eventDateMarks,
    [selected]: {
      ...eventDateMarks[selected],
      selected: true,
      disableTouchEvent: true,
      customStyles: {
        container: {
          backgroundColor: 'transparent',
          borderWidth: 0,
        },
        text: {
          color: selected === getTodayDateString() ? '#00853E' : '#000',
          fontWeight: 'bold',
        },
      },
    },
  };
  // ADD EVENT

  const handleSaveEvent = async () => {
    const submittedCategory = category === 'Other' ? otherCategory.trim() : category;
    if (
      !eventName ||
      !submittedCategory ||
      !startDate ||
      !startTime ||
      !endDate ||
      !endTime ||
      (category === 'Lot Closure' && !selectedLot)
    ) {
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
        category: submittedCategory,
        lot_name: category === 'Lot Closure' ? selectedLot : null,
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
    setOtherCategory('');
    setSelectedLot('');
    setIsLotPickerOpen(false);
    setLotSearch('');
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

  const confirmDeleteEvent = async () => {
    if (!selectedEvent) return;

    setIsDeletingEvent(true);
    try {
      await deleteAlert(selectedEvent.id);
      setSelectedEvent(null);
      setShowDeleteConfirmation(false);
      await fetchEvents();
      Alert.alert('Event deleted', 'The event has been removed from the user side.');
    } catch (error) {
      Alert.alert('Error', 'Could not delete the event. Please try again.');
    } finally {
      setIsDeletingEvent(false);
    }
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent || isDeletingEvent) return;
    setShowDeleteConfirmation(true);
  };

  return (
    <SafeAreaView style={styles.mainContainer} edges={['right', 'left']}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.title}>Campus Events</Text>
        <Text style={styles.subtitle}>Select a date to view upcoming events</Text>

        <Calendar
          onDayPress={(day) => setSelected(day.dateString)}
          markingType="custom"
          markedDates={calendarMarkedDates}
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
              activeEvents.map((eventItem) => {
                const visual = getEventVisual(eventItem.category);
                return (
                  <TouchableOpacity
                    key={eventItem.id}
                    style={styles.card}
                    onPress={() => setSelectedEvent(eventItem)}
                    accessibilityRole="button"
                    accessibilityLabel={`View details for ${eventItem.title}`}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.titleRow}>
                        <View style={[styles.iconBox, { backgroundColor: visual.bg }]}>
                          <Ionicons name={visual.icon as any} size={24} color={visual.iconColor} />
                        </View>
                        <Text style={styles.cardTitle}>{eventItem.title}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardTime}>
                      {parseUTC(eventItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {eventItem.lot_name && <Text style={styles.cardDesc}>Lot: {eventItem.lot_name}</Text>}
                    {eventItem.description && (
                       <Text style={styles.cardDesc}>{eventItem.description}</Text>
                    )}
                    <Text style={styles.clickDetails}>CLICK FOR DETAILS</Text>
                  </TouchableOpacity>
                );
              })
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
        transparent={false}
        presentationStyle="fullScreen"
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
                    onPress={() => {
                      setCategory(c);
                      if (c !== 'Other') setOtherCategory('');
                      if (c !== 'Lot Closure') {
                        setSelectedLot('');
                        setIsLotPickerOpen(false);
                        setLotSearch('');
                      }
                    }}
                  >
                    <Text style={[styles.categoryButtonText, category === c && styles.categoryButtonTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {category === 'Other' && (
                <>
                  <Text style={styles.fieldLabel}>Specify category:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Category name"
                    value={otherCategory}
                    onChangeText={setOtherCategory}
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                  />
                </>
              )}
              {category === 'Lot Closure' && (
                <>
                  <Text style={styles.fieldLabel}>Affected lot:</Text>
                  <TouchableOpacity
                    style={styles.lotSelectButton}
                    onPress={() => setIsLotPickerOpen((open) => !open)}
                    accessibilityRole="button"
                    accessibilityLabel="Choose the lot being closed"
                  >
                    <Text style={[styles.lotSelectText, !selectedLot && styles.lotSelectPlaceholder]}>
                      {selectedLot || 'Select a lot'}
                    </Text>
                    <Ionicons name={isLotPickerOpen ? 'chevron-up' : 'chevron-down'} size={22} color="#00853E" />
                  </TouchableOpacity>
                  {isLotPickerOpen && (
                    <View style={styles.lotPickerPanel}>
                      <TextInput
                        style={[styles.textInput, styles.lotSearchInput]}
                        placeholder="Search lots"
                        value={lotSearch}
                        onChangeText={setLotSearch}
                        placeholderTextColor="#999"
                        autoCapitalize="none"
                      />
                      <ScrollView style={styles.lotOptionList} keyboardShouldPersistTaps="handled">
                        {filteredLotOptions.map((lotName) => (
                          <TouchableOpacity
                            key={lotName}
                            style={[styles.lotOption, selectedLot === lotName && styles.lotOptionSelected]}
                            onPress={() => {
                              setSelectedLot(lotName);
                              setIsLotPickerOpen(false);
                              setLotSearch('');
                            }}
                          >
                            <Text style={[styles.lotOptionText, selectedLot === lotName && styles.lotOptionTextSelected]}>
                              {lotName}
                            </Text>
                            {selectedLot === lotName && <Ionicons name="checkmark" size={20} color="#00853E" />}
                          </TouchableOpacity>
                        ))}
                        {filteredLotOptions.length === 0 && (
                          <Text style={styles.lotEmptyText}>No matching lots</Text>
                        )}
                      </ScrollView>
                    </View>
                  )}
                </>
              )}

              <Text style={styles.fieldLabel}>Start date:</Text>
              <View style={styles.dateInputRow}>
                <TextInput
                  style={[styles.textInput, styles.dateTextInput]}
                  placeholder="MM/DD/YYYY"
                  value={startDate}
                  onChangeText={(value) => setStartDate((previous) => formatDateInput(value, previous))}
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setDatePickerFor(datePickerFor === 'start' ? null : 'start')}
                  accessibilityRole="button"
                  accessibilityLabel="Choose start date from calendar"
                >
                  <Ionicons name="calendar-outline" size={22} color="#00853E" />
                </TouchableOpacity>
              </View>
              {datePickerFor === 'start' && renderDateCalendar('start', startDate)}

              <Text style={styles.fieldLabel}>Start time:</Text>
              <View style={styles.timeRow}>
                <TextInput
                  style={[styles.textInput, styles.timeInput]}
                  placeholder="--:--"
                  value={startTime}
                  onChangeText={(value) => setStartTime((previous) => formatTimeInput(value, previous))}
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={5}
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
              <View style={styles.dateInputRow}>
                <TextInput
                  style={[styles.textInput, styles.dateTextInput]}
                  placeholder="MM/DD/YYYY"
                  value={endDate}
                  onChangeText={(value) => setEndDate((previous) => formatDateInput(value, previous))}
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={10}
                />
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setDatePickerFor(datePickerFor === 'end' ? null : 'end')}
                  accessibilityRole="button"
                  accessibilityLabel="Choose end date from calendar"
                >
                  <Ionicons name="calendar-outline" size={22} color="#00853E" />
                </TouchableOpacity>
              </View>
              {datePickerFor === 'end' && renderDateCalendar('end', endDate)}

              <Text style={styles.fieldLabel}>End time:</Text>
              <View style={styles.timeRow}>
                <TextInput
                  style={[styles.textInput, styles.timeInput]}
                  placeholder="--:--"
                  value={endTime}
                  onChangeText={(value) => setEndTime((previous) => formatTimeInput(value, previous))}
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={5}
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

      <Modal
        visible={selectedEvent !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeletingEvent) setSelectedEvent(null);
        }}
      >
        <View style={styles.detailsOverlay}>
          <View style={styles.detailsModal}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsTitleGroup}>
                {selectedEvent && (() => {
                  const visual = getEventVisual(selectedEvent.category);
                  return (
                    <View style={[styles.iconBox, { backgroundColor: visual.bg }]}>
                      <Ionicons name={visual.icon as any} size={24} color={visual.iconColor} />
                    </View>
                  );
                })()}
                <View style={styles.detailsTitleText}>
                  <Text style={styles.detailsTitle}>{selectedEvent?.title}</Text>
                  <Text style={styles.detailsCategory}>Category: {selectedEvent?.category}</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedEvent(null)}
                disabled={isDeletingEvent}
                accessibilityRole="button"
                accessibilityLabel="Close event details"
              >
                <Ionicons name="close" size={26} color="#555" />
              </TouchableOpacity>
            </View>

            {selectedEvent?.lot_name && (
              <View style={styles.detailsLotRow}>
                <Ionicons name="location-outline" size={19} color="#00853E" />
                <Text style={styles.detailsLotText}>Affected lot: {selectedEvent.lot_name}</Text>
              </View>
            )}

            <Text style={styles.detailsSectionTitle}>Event information</Text>
            <ScrollView style={styles.detailsDescriptionScroll}>
              <Text style={styles.detailsDescription}>
                {selectedEvent?.description || 'No additional event information.'}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={[styles.deleteEventButton, isDeletingEvent && styles.deleteEventButtonDisabled]}
              onPress={handleDeleteEvent}
              disabled={isDeletingEvent}
              accessibilityRole="button"
              accessibilityLabel="Delete event"
            >
              {isDeletingEvent ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={19} color="#fff" />
                  <Text style={styles.deleteEventText}>DELETE EVENT</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {showDeleteConfirmation && (
            <View style={styles.confirmationOverlay}>
              <View style={styles.confirmationDialog}>
                <View style={styles.confirmationIcon}>
                  <Ionicons name="alert-circle-outline" size={28} color="#B42318" />
                </View>
                <Text style={styles.confirmationTitle}>Delete event?</Text>
                <Text style={styles.confirmationMessage}>
                  Permanently delete the event before the end time. This will reflect on the user side.
                </Text>
                <View style={styles.confirmationActions}>
                  <TouchableOpacity
                    style={styles.confirmationCancelButton}
                    onPress={() => setShowDeleteConfirmation(false)}
                    disabled={isDeletingEvent}
                  >
                    <Text style={styles.confirmationCancelText}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmationDeleteButton}
                    onPress={() => { void confirmDeleteEvent(); }}
                    disabled={isDeletingEvent}
                  >
                    {isDeletingEvent ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.confirmationDeleteText}>DELETE</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
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
  cardTime: { fontSize: 12, color: '#555', marginBottom: 4, fontWeight: '600', textTransform: 'uppercase' },
  cardDesc: { fontSize: 14, color: '#444', marginBottom: 12, lineHeight: 20 },
  clickDetails: { fontSize: 10, color: '#999', fontStyle: 'italic', textAlign: 'right', fontWeight: 'bold' },
  detailsOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  detailsModal: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '82%',
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 14,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailsTitleGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  detailsTitleText: { flex: 1 },
  detailsTitle: { fontSize: 20, fontWeight: '800', color: '#222' },
  detailsCategory: { marginTop: 3, fontSize: 14, color: '#666' },
  detailsLotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  detailsLotText: { fontSize: 15, fontWeight: '700', color: '#333' },
  detailsSectionTitle: { marginBottom: 8, fontSize: 15, fontWeight: '700', color: '#333' },
  detailsDescriptionScroll: { flexShrink: 1, marginBottom: 20 },
  detailsDescription: { fontSize: 15, lineHeight: 22, color: '#444' },
  deleteEventButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: '#B42318',
  },
  deleteEventButtonDisabled: { opacity: 0.6 },
  deleteEventText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  confirmationOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  confirmationDialog: {
    width: '100%',
    maxWidth: 420,
    padding: 22,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderTopWidth: 4,
    borderTopColor: '#00853E',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  confirmationIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderRadius: 22,
    backgroundColor: '#FDE2E2',
  },
  confirmationTitle: { marginBottom: 8, fontSize: 20, fontWeight: '800', color: '#222' },
  confirmationMessage: { fontSize: 15, lineHeight: 21, color: '#555' },
  confirmationActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  confirmationCancelButton: {
    minWidth: 92,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#E8E8E8',
  },
  confirmationCancelText: { fontSize: 13, fontWeight: '800', color: '#555' },
  confirmationDeleteButton: {
    minWidth: 112,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#B42318',
  },
  confirmationDeleteText: { fontSize: 13, fontWeight: '800', color: '#fff' },

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
    backgroundColor: '#f5f5f5',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
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
  dateInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  dateTextInput: {
    flex: 1,
    marginBottom: 16,
  },
  datePickerButton: {
    width: 52,
    height: 52,
    marginLeft: 8,
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCalendar: {
    marginBottom: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    overflow: 'hidden',
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