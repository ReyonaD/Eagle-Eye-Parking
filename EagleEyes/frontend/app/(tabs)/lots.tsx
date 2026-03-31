<<<<<<< Updated upstream
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

//Top Bar
function TopBar() {
  return (
    <View style={styles.topBar}>

      {/* Left: Logo - fixed width */}
      <View style={styles.topBarSide}>
        <Image
          source={require('../../assets/images/Logo_EagleEye.png')}
          style={styles.logo}
        />
      </View>

      {/* Center: App Name */}
      <Text style={styles.appName}>EagleEyes</Text>

      {/* Right: Bell - fixed width, same as left */}
      <View style={styles.topBarSide}>
        <TouchableOpacity style={styles.bellWrapper}>
          <Ionicons name="notifications-outline" size={28} color="#333" />
        </TouchableOpacity>
      </View>

    </View>
  );
}

// Lots Screen
export default function LotsScreen() {
  return (
    <View style={styles.container}>
      <TopBar />
      <View style={styles.content}>
        <Text style={styles.title}>Parking Lots</Text>
        <Text style={styles.subtitle}>List of UNT lots will go here.</Text>
      </View>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#f9f9f9' },
  content:     { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title:       { fontSize: 32, fontWeight: 'bold', color: '#00853E', marginBottom: 10 },
  subtitle:    { fontSize: 16, color: '#666' },

  // Top Bar
  topBar:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#eee' },
  topBarSide:  { width: 50, justifyContent: 'center' },
  bellWrapper: { alignItems: 'flex-end' },
  logo:        { width: 100, height: 55, resizeMode: 'contain' },
  appName:     { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#00853E' },
});
=======
import React, { useState } from 'react';
  import {
    View,
    Text,
    FlatList,
    TextInput,
    StyleSheet,
  } from 'react-native';
  import { SafeAreaView } from 'react-native-safe-area-context';


  type AvailabilityStatus = 'Available' | 'Near Capacity' | 'Full';

  interface ParkingLot {
    id: string;
    name: string;
    permitType: string;
    status: AvailabilityStatus;
    percentEmpty: number; // 0–100
  }

  // Dummy Data
  // TODO: Replace with real API call (e.g., fetch from ParkZen / AIMS).

  const DUMMY_LOTS: ParkingLot[] = [
    { id: '1', name: 'Lot 20', permitType: 'E', status: 'Available',
  percentEmpty: 85 },
    { id: '2', name: 'Lot 11', permitType: 'F/S', status: 'Near Capacity',
  percentEmpty: 28 },
    { id: '3', name: 'Lot 1', permitType: 'A', status: 'Full', percentEmpty: 0
  },
    { id: '4', name: 'Lot 5', permitType: 'F/S', status: 'Available',
  percentEmpty: 62 },
    { id: '5', name: 'Lot 7', permitType: 'E', status: 'Near Capacity',
  percentEmpty: 35 },
    { id: '6', name: 'Lot 14', permitType: 'A', status: 'Available',
  percentEmpty: 91 },
    { id: '7', name: 'Lot 3', permitType: 'F/S', status: 'Full', percentEmpty: 0
   },
    { id: '8', name: 'Lot 22', permitType: 'E', status: 'Available',
  percentEmpty: 74 },
  ];

  // Helpers

  const STATUS_COLOR: Record<AvailabilityStatus, string> = {
    'Available': '#00853E', // UNT green
    'Near Capacity': '#F5A623', // amber
    'Full': '#D0021B', // red
  };

  // Lot Card

  function LotCard({ lot }: { lot: ParkingLot }) {
    const dotColor = STATUS_COLOR[lot.status];

    return (
      <View style={styles.card}>
        {/* Left: lot info */}
        <View style={styles.cardLeft}>
          <Text style={styles.lotName}>{lot.name}</Text>
          <Text style={styles.permitLabel}>Permit: {lot.permitType}</Text>
        </View>

        {/* Right: status badge + percentage */}
        <View style={styles.cardRight}>
          <View style={[styles.statusBadge, { backgroundColor: dotColor + '1A'
  }]}>
            <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
            <Text style={[styles.statusText, { color: dotColor 
  }]}>{lot.status}</Text>
          </View>
          {lot.percentEmpty > 0 && (
            <Text style={styles.percentText}>{lot.percentEmpty}% open</Text>
          )}
        </View>
      </View>
    );
  }

  // List Header (scrolls with the list)

  function ListHeader({ query, onChangeQuery }: { query: string; onChangeQuery:
  (text: string) => void }) {
    return (
      <>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Parking Lots</Text>
          <Text style={styles.headerSubtitle}>UNT Campus · Live
  Availability</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="Lot Search  (e.g. Lot 20, E, F/S)"
            placeholderTextColor="#aaa"
            value={query}
            onChangeText={onChangeQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {(Object.keys(STATUS_COLOR) as AvailabilityStatus[]).map((status) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: 
  STATUS_COLOR[status] }]} />
              <Text style={styles.legendLabel}>{status}</Text>
            </View>
          ))}
        </View>
      </>
    );                                                                          
  }
                                                                                
  // Main Screen                                                                
   
  export default function LotsScreen() {                                        
    const [query, setQuery] = useState('');
                                                                                
    // Filter lots by name or permit type as the user types.
    // TODO: When using real API data, you can filter server-side instead.
    const filtered = DUMMY_LOTS.filter((lot) => {
      const q = query.toLowerCase();                                            
      return (
        lot.name.toLowerCase().includes(q) ||                                   
        lot.permitType.toLowerCase().includes(q)
      );                                                                        
    });           
                                                                                
    return (      
      <SafeAreaView style={styles.screen}>
        <FlatList                                                               
          data={filtered}
          keyExtractor={(item) => item.id}                                      
          renderItem={({ item }) => <LotCard lot={item} />}                     
          ListHeaderComponent={<ListHeader query={query}                        
  onChangeQuery={setQuery} />}                                                  
          contentContainerStyle={styles.listContent}                            
          ListEmptyComponent={                                                  
            <Text style={styles.emptyText}>No lots match your search.</Text>    
          }                                                                     
          keyboardShouldPersistTaps="handled"                                   
        />                                                                      
      </SafeAreaView>
    );                                                                          
  }                                                                             
                                                                                
  // Styles                                                                     
                  
  const styles = StyleSheet.create({                                            
    screen: {     
      flex: 1,                                                                  
      backgroundColor: '#f9f9f9',                                               
    },                                                                          
                                                                                
    // Header                                                                   
    header: {     
      paddingHorizontal: 20,                                                    
      paddingTop: 18,                                                           
      paddingBottom: 10,                                                        
      backgroundColor: '#fff',                                                  
      borderBottomWidth: 1,                                                     
      borderBottomColor: '#e8e8e8',                                             
    },                                                                          
    headerTitle: {                                                              
      fontSize: 26,                                                             
      fontWeight: '700',                                                        
      color: '#00853E',                                                         
    },                                                                          
    headerSubtitle: {                                                           
      fontSize: 13,                                                             
      color: '#888',                                                            
      marginTop: 2,                                                             
    },                                                                          
                                                                                
    // Search                                                                   
    searchWrapper: {                                                            
      paddingHorizontal: 16,                                                    
      paddingVertical: 12,                                                      
      backgroundColor: '#fff',                                                  
      borderBottomWidth: 1,                                                     
      borderBottomColor: '#e8e8e8',                                             
    },                                                                          
    searchInput: {                                                              
      height: 44,                                                               
      backgroundColor: '#f9f9f9',                                               
      borderRadius: 10,                                                         
      paddingHorizontal: 14,                                                    
      fontSize: 15,                                                             
      color: '#222',                                                            
    },                                                                          
                                                                                
    // Legend     
    legend: {                                                                   
      flexDirection: 'row',                                                     
      paddingHorizontal: 16,                                                    
      paddingVertical: 10,                                                      
      gap: 16,                                                                  
      backgroundColor: '#fff',                                                  
      borderBottomWidth: 1,                                                     
      borderBottomColor: '#e8e8e8',                                             
      marginBottom: 6,                                                          
    },                                                                          
    legendItem: {                                                               
      flexDirection: 'row',                                                     
      alignItems: 'center',                                                     
      gap: 5,                                                                   
    },                                                                          
    legendDot: {                                                                
      width: 9,                                                                 
      height: 9,  
      borderRadius: 5,                                                          
    },                                                                          
    legendLabel: {                                                              
      fontSize: 12,                                                             
      color: '#555',                                                            
    },                                                                          
                                                                                
    // List                                                                     
    listContent: {
      paddingHorizontal: 16,                                                    
      paddingBottom: 16,                                                        
      gap: 10,                                                                  
    },                                                                          
    emptyText: {                                                                
      textAlign: 'center',                                                      
      marginTop: 40,                                                            
      color: '#999',                                                            
      fontSize: 15,                                                             
    },                                                                          
                                                                                
    // Card                                                                     
    card: {       
      flexDirection: 'row',                                                     
      justifyContent: 'space-between',                                          
      alignItems: 'center',                                                     
      backgroundColor: '#fff',                                                  
      borderRadius: 12,                                                         
      padding: 16,                                                              
      shadowColor: '#000',                                                      
      shadowOffset: { width: 0, height: 1 },                                    
      shadowOpacity: 0.07,                                                      
      shadowRadius: 4,                                                          
      elevation: 2,                                                             
    },                                                                          
    cardLeft: {                                                                 
      gap: 4,                                                                   
    },                                                                          
    lotName: {    
      fontSize: 17,                                                             
      fontWeight: '600',
      color: '#1a1a1a',
    },                                                                          
    permitLabel: {
      fontSize: 13,                                                             
      color: '#777',                                                            
    },                                                                          
    cardRight: {                                                                
      alignItems: 'flex-end',                                                   
      gap: 6,                                                                   
    },                                                                          
    statusBadge: {                                                              
      flexDirection: 'row',                                                     
      alignItems: 'center',                                                     
      paddingHorizontal: 10,                                                    
      paddingVertical: 5,                                                       
      borderRadius: 20,                                                         
      gap: 6,     
    },                                                                          
    statusDot: {  
      width: 8,
      height: 8,                                                                
      borderRadius: 4,                                                          
    },                                                                          
    statusText: {                                                               
      fontSize: 13,                                                             
      fontWeight: '600',
    },
    percentText: {
      fontSize: 12,                                                             
      color: '#999',
    },                                                                          
  });         
>>>>>>> Stashed changes
