import React, {useState} from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image} from 'react-native';
import { router } from 'expo-router';
import { login } from '../api/auth';
import { Alert } from '../utils/webCompat';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert("Error", "Both fields are required");
            return;
        }
        setIsLoading(true);
        try {
            const userData = await login(email, password);
            //route the user based on the role provided in the JWT token
            if (userData.role === 'admin'){
              router.replace('/(admin)');
            }else{
              router.replace('/(tabs)');
            }
        } catch (error) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/images/Logo_EagleEye.png')}
          style={styles.logoImage}
        />
        <Text style={styles.logoText}>EagleEyes</Text>
      </View>
      <Text style={styles.subtitle}>UNT Campus Parking</Text>

      <TextInput
        style={styles.input}
        placeholder="UNT Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity
        style={styles.forgotWrapper}
        onPress={() => router.push('/forgot-password')}
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        {/* Route to the Register screen */}
        <TouchableOpacity onPress={() => router.push('/register')}>
          <Text style={styles.linkText}>Sign Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9f9f9' },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  llogoContainer: {
    alignItems: 'center',
    marginBottom: 30, // Pushes the input fields or content down
  },
  logoImage: {
    width: 120, 
    height: 80,
    resizeMode: 'contain',
    marginBottom: 10, // Space between the logo and the text
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00853E', // UNT Green
  },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  input: { height: 52, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, marginBottom: 16, fontSize: 16 },
  forgotWrapper: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 12 },
  forgotText: { fontSize: 14, color: '#00853E', fontWeight: '600' },
  primaryButton: { backgroundColor: '#00853E', height: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 15, color: '#666' },
  linkText: { fontSize: 15, color: '#00853E', fontWeight: 'bold' }
});
