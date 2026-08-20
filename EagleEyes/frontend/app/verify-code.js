import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { verifyResetCode } from '../api/auth';

export default function VerifyCodeScreen() {
  const params = useLocalSearchParams();
  //email travels from the forgot-password screen
  const email = typeof params?.email === 'string' ? params.email : '';
  const [code, setCode] = useState('');
  const inputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (code.length !== 6) {
      Alert.alert("Error", "The verification code is 6 digits");
      return;
    }
    setIsLoading(true);
    try {
      await verifyResetCode(email, code);
      //code is valid -> move on to the new-password step, carrying email + code along
      router.replace({ pathname: '/reset-password', params: { email, code } });
    } catch (error) {
      Alert.alert("Invalid Code", error.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Code</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to{'\n'}
        <Text style={styles.emailText}>{email}</Text>
      </Text>

      {/* invisible input captures the typing; the 6 boxes below just display it */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={code}
        onChangeText={(t) => setCode(t.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        autoFocus
      />
      <Pressable style={styles.codeRow} onPress={() => inputRef.current?.focus()}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View
            key={i}
            style={[styles.codeBox, i === code.length && styles.codeBoxActive]}
          >
            <Text style={styles.codeDigit}>{code[i] || ''}</Text>
          </View>
        ))}
      </Pressable>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify Code</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/forgot-password')}>
        <Text style={styles.backButtonText}>Didn't get it? Send a new code</Text>
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
  emailText: { fontWeight: 'bold', color: '#333' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  codeRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 24 },
  codeBox: { width: 48, height: 56, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  codeBoxActive: { borderColor: '#00853E', borderWidth: 2 },
  codeDigit: { fontSize: 26, fontWeight: 'bold', color: '#333' },
  primaryButton: { backgroundColor: '#00853E', height: 52, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backButton: { marginTop: 20, alignItems: 'center' },
  backButtonText: { fontSize: 16, color: '#666' }
});
