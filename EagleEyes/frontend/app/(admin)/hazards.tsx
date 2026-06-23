import {View, Text, StyleSheet} from 'react-native';
export default function HazardsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hazards Reports</Text>
      <Text style={styles.subtitle}>This is where you can manage hazards on campus.</Text>
      <Text style={styles.subtitle}>Feature coming soon! Stay tuned for updates.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#00853E' },
  subtitle: { fontSize: 16, color: '#666', marginTop: 8 },
});