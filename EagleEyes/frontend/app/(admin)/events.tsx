import { View, Text, StyleSheet } from 'react-native';

export default function EventScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Event Management</Text>
      <Text style={styles.subtitle}>
        This is the Event tab. Add your event UI here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#00853E',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
