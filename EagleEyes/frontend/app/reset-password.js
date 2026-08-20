import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { resetPassword } from '../api/auth';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  //email travels from the forgot-password screen; user can still edit it if needed
  const [email, setEmail] = useState(typeof params?.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !code || !password || !confirmPassword) {
      Alert.alert("Error", "All fields are required");
      return;
    }
    if (code.length !== 6) {
      Alert.alert("Error", "The verification code is 6 digits");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }
    setIsLoading(true);
    try {
      await resetPassword(email, code, password);
      Alert.alert(
        "Success",
        "Your password has been reset. You can now log in.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert("Reset Failed", error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code we emailed to you, then choose a new password.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="UNT Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={[styles.input, styles.codeInput]}
        placeholder="6-digit code"
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
      />

      <TextInput
        style={styles.input}
        placeholder="New Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset Password</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f9f9f9' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#333', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 32, paddingHorizontal: 12 },
  input: { height: 52, backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 16, marginBottom: 16, fontSize: 16 },
  codeInput: { textAlign: 'center', fontSize: 24, letterSpacing: 12, fontWeight: 'bold' },
  primaryButton: { backgroundColor: '#00853E', height: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { fontSize: 16, color: '#666' }
});
