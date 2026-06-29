import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { getAlerts } from '../../api/alerts'; 

const getIconForCategory = (category: string) => {
  switch (category?.toLowerCase()) {
    case 'gameday': return 'american-football'; 
    case 'tailgate': return 'flame';
    case 'concert': return 'musical-notes';
    case 'career': return 'briefcase';
    default: return 'calendar';
  }
};
const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
export default function EventsScreen() {
  const [selected, setSelected] = useState(getTodayDateString());
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data for EVENTS instead of hazards
  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      // This single line change does all the heavy lifting!
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

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const m = months[Number(month) - 1] ?? '';
    return `${m} ${Number(day)}, ${year}`;
  };
  //Filter for ACTIVE events (matches the selected date exactly)
  const activeEvents = events.filter(eventItem => 
    eventItem.created_at && eventItem.created_at.startsWith(selected)
  );
  // Filter for PAST events (dates strictly before the selected date)
  // We limit to the 5 most recent past events so the screen doesn't get infinitely long.
  const pastEvents = events.filter(eventItem => {
    if (!eventItem.created_at) return false;
    const eventDate = eventItem.created_at.split('T')[0]; // Grabs just the YYYY-MM-DD
    return eventDate < selected;
  }).slice(0, 5);


  return (
    <View style={styles.mainContainer}>
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
                    {new Date(eventItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {eventItem.description && (
                     <Text style={styles.cardDesc}>{eventItem.description}</Text>
                  )}
                  <Text style={styles.clickDetails}>CLICK FOR DETAILS</Text>
                </TouchableOpacity>
              ))
            )}

            {/* --- SECTION 2: PAST / OUTDATED EVENTS --- */}
            {pastEvents.length > 0 && !isLoading && (
              <View style={styles.pastEventsWrapper}>
                <View style={styles.divider} />
                <Text style={styles.pastFeedTitle}>Previous Events</Text>
                
                {pastEvents.map((eventItem) => (
                  <TouchableOpacity 
                    key={`past-${eventItem.id}`} 
                    style={[styles.card, styles.outdatedCard]} 
                    onPress={() => Alert.alert('Past Event', 'This event has already concluded.')}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.titleRow}>
                        <View style={[styles.iconBox, styles.outdatedIconBox]}>
                          <Ionicons name={getIconForCategory(eventItem.category)} size={20} color="#666" />
                        </View>
                        <Text style={[styles.cardTitle, styles.outdatedText]}>{eventItem.title}</Text>
                      </View>
                    </View>
                    
                    <Text style={[styles.cardTime, styles.outdatedText]}>
                      {formatDate(eventItem.created_at.split('T')[0])} • {new Date(eventItem.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    
                    <Text style={[styles.clickDetails, styles.outdatedText]}>CONCLUDED</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => Alert.alert('Add Event', 'This will route to the event submission form!')} 
      >
        <View style={styles.fabContent}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.fabText}>Add Event</Text>
        </View>
      </TouchableOpacity>
    </View>
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
    backgroundColor: '#e8e8e8',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    position: 'relative',
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
    backgroundColor: '#d4edda', 
    padding: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: '900', color: '#000', flexShrink: 1 },
  badge: {
    backgroundColor: '#007AFF', 
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: -8,
    right: -8,
    borderWidth: 2,
    borderColor: '#e8e8e8',
    zIndex: 1,
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  cardTime: { fontSize: 12, color: '#555', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase' },
  cardDesc: { fontSize: 14, color: '#444', marginBottom: 12, lineHeight: 20 },
  clickDetails: { fontSize: 11, color: '#666', fontStyle: 'italic', textAlign: 'right', fontWeight: 'bold' },
  
  pastEventsWrapper: { marginTop: 8 },
  divider: { height: 1, backgroundColor: '#ddd', marginBottom: 16 },
  pastFeedTitle: { fontSize: 16, fontWeight: 'bold', color: '#888', marginBottom: 12, textTransform: 'uppercase' },
  outdatedCard: {
    backgroundColor: '#f9f9f9',
    borderColor: '#eee',
    borderWidth: 1,
    opacity: 0.65,
    padding: 12,
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
});