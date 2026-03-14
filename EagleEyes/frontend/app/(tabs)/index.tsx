import { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, Platform } from 'react-native';

const BACKEND_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:8000/api/v1/health' 
  : 'http://localhost:8000/api/v1/health';

export default function Home() {
  const [serverMessage, setServerMessage] = useState('Connecting to FastAPI...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(BACKEND_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        setServerMessage(`Connected! Status: ${JSON.stringify(data)}`);
        setLoading(false);
      })
      .catch((error) => {
        setServerMessage(`Connection Failed: ${error.message}`);
        setLoading(false);
      });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>EagleEyes Diagnostics</Text>
      
      {loading ? <ActivityIndicator size="large" color="#0000ff" /> : null}
      
      <View style={styles.statusBox}>
        <Text style={styles.status}>{serverMessage}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#00853E', 
  },
  statusBox: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
});