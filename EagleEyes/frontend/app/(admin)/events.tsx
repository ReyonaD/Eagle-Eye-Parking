import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, Platform } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { getAlerts, createAlert, updateEvent, deleteAlert } from '../../api/alerts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '../../utils/webCompat';
import { getEventVisual, EVENT_CATEGORIES } from '../../utils/alertVisuals';
import DatePickerModal from '../../components/DatePickerModal';
import LotPickerModal from '../../components/LotPickerModal';
import { parseLotNames, joinLotNames, formatLotNames, CLOSURE_CATEGORY, isClosureCategory } from '../../utils/lotStatus';
import { useFocusPolling } from '../../hooks/use-focus-polling';
import {
  toLocalDateString, getTodayDateString, isoToLocalDate, formatDate,
  getEventRange, stripScheduleFromDescription, isAllDayRange, formatEventTimes,
  startOfDay, endOfDay,
} from '../../utils/eventDates';
import ToggleChip from '../../components/ToggleChip';
import TimePickerField from '../../components/TimePickerField';

const IS_WEB = Platform.OS === 'web';

//"H:MM" or "HH:MM" + AM/PM -> 24h hours/minutes, or null if malformed
const parseTime12h = (s: string, period: string): { hours: number; minutes: number } | null => {
  const m = s.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours < 1 || hours > 12 || minutes > 59) return null;
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
};

//Date -> the "H:MM" + AM/PM pair the time fields use (inverse of parseTime12h)
const toTime12h = (d: Date): { time: string; period: 'AM' | 'PM' } => {
  const h24 = d.getHours();
  return {
    time: `${h24 % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}`,
    period: h24 >= 12 ? 'PM' : 'AM',
  };
};

const combineDateAndTime = (date: Date, time: { hours: number; minutes: number }): Date => {
  const combined = new Date(date);
  combined.setHours(time.hours, time.minutes, 0, 0);
  return combined;
};

export default function EventsScreen() {
  const { openAdd, reuseId } = useLocalSearchParams<{ openAdd?: string; reuseId?: string }>();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(getTodayDateString());
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  //the event whose details modal is open, and its delete flow
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const fetchEvents = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      const data = await getAlerts('event');
      setEvents(data);
    } catch (error) {
      Alert.alert("Error", "Could not load campus events.");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => { fetchEvents(); }, [])
  );
  //keep the calendar/feed fresh while the admin has this tab open, so a new
  //commuter-triggered event doesn't require leaving and reopening the screen
  useFocusPolling(() => fetchEvents(false));
  
  const [showAddEventModal, setShowAddEventModal] = useState(false);

  // Lets the Profile tab's "Add New Event" action reuse this same modal instead
  // of duplicating the form, by deep-linking here with ?openAdd=1.
  useEffect(() => {
    if (openAdd) setShowAddEventModal(true);
  }, [openAdd]);

  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  //free-text category typed in when "Other" is picked
  const [otherCategory, setOtherCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [startTimePeriod, setStartTimePeriod] = useState('AM');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [endTimePeriod, setEndTimePeriod] = useState('AM');
  //"All day" skips both time fields (midnight -> 11:59 PM); "No end date"
  //skips the end fields entirely for TBD/permanent events (saved with no event_end)
  const [allDay, setAllDay] = useState(false);
  const [noEndDate, setNoEndDate] = useState(false);
  const [description, setDescription] = useState('');
  //lots this event affects - drives how they look on the commuter map
  const [affectedLots, setAffectedLots] = useState<string[]>([]);
  const [showLotPicker, setShowLotPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  //set while the form is editing an existing event instead of adding a new one
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  //which of the two date fields the mini-calendar picker is currently editing
  const [activeDateField, setActiveDateField] = useState<'start' | 'end' | null>(null);

  //Events whose [start, end] range actually covers the selected day
  const activeEvents = events.filter(eventItem => {
    const { start, end } = getEventRange(eventItem);
    const day = toLocalDateString(start);
    const lastDay = toLocalDateString(end);
    return day <= selected && selected <= lastDay;
  });

  //already-finished events, most recently ended first - lets an admin reuse a
  //recurring event (e.g. a weekly gameday) instead of retyping it every time
  const pastEvents = useMemo(() => {
    const today = getTodayDateString();
    return events
      .filter(eventItem => toLocalDateString(getEventRange(eventItem).end) < today)
      .sort((a, b) => getEventRange(b).end.getTime() - getEventRange(a).end.getTime())
      .slice(0, 8);
  }, [events]);

  //One calendar dot per day that has at least one event, regardless of how
  //many - merged with the currently-selected day's highlight.
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    events.forEach(eventItem => {
      const { start, end } = getEventRange(eventItem);
      let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      let guard = 0;
      while (cursor <= last && guard < 366) {
        const key = toLocalDateString(cursor);
        marks[key] = { ...(marks[key] || {}), marked: true, dotColor: '#00853E' };
        cursor.setDate(cursor.getDate() + 1);
        guard++;
      }
    });
    marks[selected] = { ...(marks[selected] || {}), selected: true, disableTouchEvent: true, selectedColor: '#00853E' };
    return marks;
  }, [events, selected]);
  // ADD EVENT

  const handleSaveEvent = async () => {
    const submittedCategory = category === 'Other' ? otherCategory.trim() : category;
    if (
      !eventName || !submittedCategory || !startDate ||
      (!allDay && !startTime) ||
      (!noEndDate && (!endDate || (!allDay && !endTime)))
    ) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    if (category === CLOSURE_CATEGORY && affectedLots.length === 0) {
      Alert.alert('Validation Error', 'Please select at least one lot to close.');
      return;
    }

    const startHM = allDay ? null : parseTime12h(startTime, startTimePeriod);
    const endHM = allDay || noEndDate ? null : parseTime12h(endTime, endTimePeriod);
    if ((!allDay && !startHM) || (!allDay && !noEndDate && !endHM)) {
      Alert.alert('Validation Error', 'Please pick a start and end time.');
      return;
    }

    const eventStart = startHM
      ? combineDateAndTime(isoToLocalDate(startDate), startHM)
      : startOfDay(isoToLocalDate(startDate));
    let eventEnd: Date | null = null;
    if (!noEndDate) {
      eventEnd = endHM
        ? combineDateAndTime(isoToLocalDate(endDate), endHM)
        : endOfDay(isoToLocalDate(endDate));
    }
    if (eventEnd && eventEnd < eventStart) {
      Alert.alert('Validation Error', 'End date/time must be after the start date/time.');
      return;
    }

    setIsSaving(true);
    try {
      //still fold the schedule into the description as human-readable text,
      //but event_start/event_end are now what drive the calendar and filtering
      const startText = allDay ? formatDate(startDate) : `${formatDate(startDate)} ${startTime} ${startTimePeriod}`;
      const endText = noEndDate
        ? 'No end date'
        : allDay ? formatDate(endDate) : `${formatDate(endDate)} ${endTime} ${endTimePeriod}`;
      const schedule = allDay && !noEndDate && startDate === endDate
        ? `When: ${formatDate(startDate)} (All day)`
        : `When: ${startText} – ${endText}${allDay ? ' (All day)' : ''}`;
      const fullDescription = description.trim() ? `${schedule}\n\n${description.trim()}` : schedule;

      const eventData = {
        title: eventName.trim(),
        category: submittedCategory,
        description: fullDescription,
        lot_name: affectedLots.length ? joinLotNames(affectedLots) : undefined,
        event_start: eventStart.toISOString(),
        event_end: eventEnd ? eventEnd.toISOString() : undefined,
      };
      if (editingEventId !== null) {
        //null (not undefined) so switching to "No end date" clears the old end
        await updateEvent(editingEventId, { ...eventData, event_end: eventData.event_end ?? null });
        Alert.alert('Success', 'Event updated successfully');
      } else {
        await createAlert({ ...eventData, alert_type: 'event' });
        Alert.alert('Success', 'Event created successfully');
      }
      setShowAddEventModal(false);
      resetForm();
      fetchEvents();
    } catch (error) {
      Alert.alert('Error', `Could not ${editingEventId !== null ? 'update' : 'create'} the event. Please try again.`);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEventName('');
    setCategory(null);
    setOtherCategory('');
    setStartDate('');
    setStartTime('');
    setStartTimePeriod('AM');
    setEndDate('');
    setEndTime('');
    setEndTimePeriod('AM');
    setAllDay(false);
    setNoEndDate(false);
    setDescription('');
    setAffectedLots([]);
    setEditingEventId(null);
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

  //pre-fill the Add Event form from a past event, but leave the date/time
  //fields blank - the whole point is picking a NEW date, never the old one
  const handleReuseEvent = (eventItem: any) => {
    setEventName(eventItem.title || '');
    loadCategory(eventItem.category);
    setDescription(stripScheduleFromDescription(eventItem.description || ''));
    setAffectedLots(parseLotNames(eventItem.lot_name));
    //keep the old event's shape (all-day / open-ended), just not its dates
    const oldRange = getEventRange(eventItem);
    setAllDay(isAllDayRange(oldRange));
    setNoEndDate(oldRange.openEnded);
    setStartDate('');
    setStartTime('');
    setStartTimePeriod('AM');
    setEndDate('');
    setEndTime('');
    setEndTimePeriod('AM');
    setShowAddEventModal(true);
  };

  //puts a saved event's category back into the picker: a custom one typed
  //under "Other" goes back in the text box, and the old "Closure" name maps
  //to the current closure category
  const loadCategory = (stored?: string | null) => {
    if (!stored) { setCategory(null); setOtherCategory(''); return; }
    if (isClosureCategory(stored)) { setCategory(CLOSURE_CATEGORY); setOtherCategory(''); return; }
    if (EVENT_CATEGORIES.includes(stored)) { setCategory(stored); setOtherCategory(''); return; }
    setCategory('Other');
    setOtherCategory(stored);
  };

  //open the same form pre-filled with an event's current details, dates
  //included - e.g. to give an event saved with "No end date" its real end
  const handleEditEvent = (eventItem: any) => {
    const range = getEventRange(eventItem);
    const isAllDay = isAllDayRange(range);
    setEventName(eventItem.title || '');
    loadCategory(eventItem.category);
    setDescription(stripScheduleFromDescription(eventItem.description || ''));
    setAffectedLots(parseLotNames(eventItem.lot_name));
    setAllDay(isAllDay);
    setNoEndDate(range.openEnded);
    setStartDate(toLocalDateString(range.start));
    const start12 = toTime12h(range.start);
    setStartTime(isAllDay ? '' : start12.time);
    setStartTimePeriod(start12.period);
    if (range.openEnded) {
      setEndDate('');
      setEndTime('');
      setEndTimePeriod('AM');
    } else {
      const end12 = toTime12h(range.end);
      setEndDate(toLocalDateString(range.end));
      setEndTime(isAllDay ? '' : end12.time);
      setEndTimePeriod(end12.period);
    }
    setEditingEventId(eventItem.id);
    setShowAddEventModal(true);
  };

  //the Past Events page deep-links back here with ?reuseId=<id>; wait for the
  //matching event to show up in the fetched list, then fire the reuse flow
  //once (a ref, not state, so re-fetching events after save doesn't reopen it)
  const reuseHandledRef = useRef(false);
  useEffect(() => {
    if (!reuseId || reuseHandledRef.current) return;
    const found = events.find(e => String(e.id) === String(reuseId));
    if (found) {
      reuseHandledRef.current = true;
      handleReuseEvent(found);
    }
  }, [reuseId, events]);

  return (
    <SafeAreaView style={styles.mainContainer} edges={['right', 'left']}>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 100 }}>
        <Text style={styles.title}>Campus Events</Text>
        <Text style={styles.subtitle}>Select a date to view upcoming events</Text>

        <View style={IS_WEB && styles.webLayout}>
          <View style={IS_WEB && styles.webCalendarCol}>
            <Calendar
              onDayPress={(day) => setSelected(day.dateString)}
              markedDates={markedDates}
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
          </View>
          {selected && (
            <View style={[styles.feedContainer, IS_WEB && styles.webFeedCol]}>

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
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.titleRow}>
                          <View style={[styles.iconBox, { backgroundColor: visual.bg }]}>
                            <Ionicons name={visual.icon as any} size={24} color={visual.iconColor} />
                          </View>
                          <Text style={styles.cardTitle}>{eventItem.title}</Text>
                        </View>
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{eventItem.upvotes}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardTime}>{formatEventTimes(eventItem)}</Text>
                      {!!eventItem.lot_name && (
                        <Text style={styles.cardLots}>📍 {formatLotNames(eventItem.lot_name)}</Text>
                      )}
                      {eventItem.description && (
                         <Text style={styles.cardDesc}>{eventItem.description}</Text>
                      )}
                      <View style={styles.cardFooter}>
                        <TouchableOpacity
                          style={styles.editButton}
                          onPress={() => handleEditEvent(eventItem)}
                          accessibilityLabel={`Edit ${eventItem.title}`}
                        >
                          <Ionicons name="create-outline" size={14} color="#00853E" />
                          <Text style={styles.editButtonText}>EDIT</Text>
                        </TouchableOpacity>
                        <Text style={styles.clickDetails}>CLICK FOR DETAILS</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

            </View>
          )}
        </View>

        {IS_WEB && pastEvents.length > 0 && (
          <View style={styles.pastEventsSection}>
            <Text style={styles.pastEventsTitle}>REUSE A PAST EVENT</Text>
            <Text style={styles.pastEventsSubtitle}>
              Recreate a recurring event with a new date instead of retyping it
            </Text>
            {pastEvents.map(eventItem => {
              const visual = getEventVisual(eventItem.category);
              const { end } = getEventRange(eventItem);
              return (
                <View key={eventItem.id} style={styles.pastEventRow}>
                  <View style={[styles.iconBox, { backgroundColor: visual.bg }]}>
                    <Ionicons name={visual.icon as any} size={20} color={visual.iconColor} />
                  </View>
                  <View style={styles.pastEventInfo}>
                    <Text style={styles.pastEventTitle} numberOfLines={1}>{eventItem.title}</Text>
                    <Text style={styles.pastEventMeta}>{eventItem.category} · {formatDate(toLocalDateString(end))}</Text>
                  </View>
                  <TouchableOpacity style={styles.reuseButton} onPress={() => handleReuseEvent(eventItem)}>
                    <Ionicons name="refresh" size={14} color="#00853E" />
                    <Text style={styles.reuseButtonText}>REUSE</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {!IS_WEB && pastEvents.length > 0 && (
          <TouchableOpacity
            style={styles.pastEventsLinkButton}
            onPress={() => router.push('/(admin)/past-events')}
          >
            <Ionicons name="time-outline" size={20} color="#00853E" />
            <Text style={styles.pastEventsLinkText}>VIEW PAST EVENTS</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </TouchableOpacity>
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
          {/* full-height modal: push content below the status bar / notch */}
          <View style={[styles.modalContent, { paddingTop: insets.top + 20 }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.modalBackButton} onPress={handleCancel} disabled={isSaving}>
                {!IS_WEB && <Ionicons name="chevron-back" size={20} color="#00853E" />}
                <Text style={styles.modalBackText}>{IS_WEB ? 'Cancel' : 'Back'}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{editingEventId !== null ? 'Edit Event' : 'Add Event'}</Text>

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

              <Text style={styles.fieldLabel}>
                Affected lots{category === CLOSURE_CATEGORY ? ' (required)' : ' (optional)'}:
              </Text>
              {affectedLots.length > 0 && (
                <View style={styles.lotChipRow}>
                  {affectedLots.map((lotName) => (
                    <View key={lotName} style={styles.lotChip}>
                      <Text style={styles.lotChipText}>{lotName}</Text>
                      <TouchableOpacity
                        onPress={() => setAffectedLots((prev) => prev.filter((n) => n !== lotName))}
                        accessibilityLabel={`Remove ${lotName}`}
                      >
                        <Ionicons name="close-circle" size={16} color="#00853E" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowLotPicker(true)}>
                <Ionicons name="location-outline" size={18} color="#999" />
                <Text style={styles.dateButtonText}>ADD LOT</Text>
              </TouchableOpacity>

              <View style={styles.toggleRow}>
                <ToggleChip label="All day" value={allDay} onChange={setAllDay} />
                <ToggleChip label="No end date (TBD / permanent)" value={noEndDate} onChange={setNoEndDate} />
              </View>

              <Text style={styles.fieldLabel}>Start date:</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setActiveDateField('start')}>
                <Ionicons name="calendar-outline" size={18} color={startDate ? '#00853E' : '#999'} />
                <Text style={[styles.dateButtonText, startDate && styles.dateButtonTextFilled]}>
                  {startDate ? formatDate(startDate) : 'SELECT START DATE'}
                </Text>
              </TouchableOpacity>

              {!allDay && (
                <>
                  <Text style={styles.fieldLabel}>Start time:</Text>
                  <TimePickerField
                    time={startTime}
                    period={startTimePeriod}
                    onChange={(t, p) => { setStartTime(t); setStartTimePeriod(p); }}
                    placeholder="SELECT START TIME"
                    title="Start time"
                  />
                </>
              )}

              {!noEndDate && (
                <>
                  <Text style={styles.fieldLabel}>End date:</Text>
                  <TouchableOpacity style={styles.dateButton} onPress={() => setActiveDateField('end')}>
                    <Ionicons name="calendar-outline" size={18} color={endDate ? '#00853E' : '#999'} />
                    <Text style={[styles.dateButtonText, endDate && styles.dateButtonTextFilled]}>
                      {endDate ? formatDate(endDate) : 'SELECT END DATE'}
                    </Text>
                  </TouchableOpacity>

                  {!allDay && (
                    <>
                      <Text style={styles.fieldLabel}>End time:</Text>
                      <TimePickerField
                        time={endTime}
                        period={endTimePeriod}
                        onChange={(t, p) => { setEndTime(t); setEndTimePeriod(p); }}
                        placeholder="SELECT END TIME"
                        title="End time"
                      />
                    </>
                  )}
                </>
              )}

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

      <LotPickerModal
        visible={showLotPicker}
        onClose={() => setShowLotPicker(false)}
        onSelect={(lotName) => setAffectedLots((prev) => (prev.includes(lotName) ? prev : [...prev, lotName]))}
      />

      <DatePickerModal
        visible={activeDateField !== null}
        onClose={() => setActiveDateField(null)}
        onSelect={(dateString) => {
          if (activeDateField === 'start') setStartDate(dateString);
          if (activeDateField === 'end') setEndDate(dateString);
        }}
        initialDate={(activeDateField === 'start' ? startDate : endDate) || undefined}
        minDate={activeDateField === 'end' ? (startDate || undefined) : undefined}
        title={activeDateField === 'start' ? 'Select start date' : 'Select end date'}
      />

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

            {selectedEvent && (
              <View style={styles.detailsLotRow}>
                <Ionicons name="time-outline" size={19} color="#00853E" />
                <Text style={styles.detailsLotText}>{formatEventTimes(selectedEvent)}</Text>
              </View>
            )}
            {!!selectedEvent?.lot_name && (
              <View style={styles.detailsLotRow}>
                <Ionicons name="location-outline" size={19} color="#00853E" />
                <Text style={styles.detailsLotText}>
                  {parseLotNames(selectedEvent.lot_name).length > 1 ? 'Affected lots' : 'Affected lot'}: {formatLotNames(selectedEvent.lot_name)}
                </Text>
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
  scrollContainer: { flex: 1, padding: 16 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#00853E', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20 },
  
  webLayout: {
    flexDirection: 'row',
    gap: 20,
  },
  webCalendarCol: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#00853E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  webFeedCol: {
    flex: 1,
    marginTop: 0,
  },
  pastEventsSection: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#999',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pastEventsTitle: { fontSize: 14, fontWeight: '900', color: '#888', letterSpacing: 1, marginBottom: 4 },
  pastEventsSubtitle: { fontSize: 12, color: '#999', marginBottom: 14 },
  pastEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  pastEventInfo: { flex: 1 },
  pastEventTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  pastEventMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  reuseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E8F5EE',
  },
  reuseButtonText: { fontSize: 11, fontWeight: '800', color: '#00853E', letterSpacing: 0.5 },
  pastEventsLinkButton: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pastEventsLinkText: { flex: 1, fontSize: 14, fontWeight: '800', color: '#00853E', letterSpacing: 0.5 },
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
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#00853E',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  editButtonText: { fontSize: 11, color: '#00853E', fontWeight: '800' },

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
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  cardLots: {
    fontSize: 13,
    color: '#00853E',
    fontWeight: '600',
    marginBottom: 4,
  },
  lotChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  lotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    borderRadius: 14,
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 6,
  },
  lotChipText: {
    fontSize: 13,
    color: '#00853E',
    fontWeight: '600',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
  },
  dateButtonTextFilled: {
    color: '#333',
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