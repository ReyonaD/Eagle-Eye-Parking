import React, { useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { submitLogs } from '../../api/logs';
import { Alert } from '../../utils/webCompat';

export default function HelpSupportScreen() {
  const [sendingLogs, setSendingLogs] = useState(false);

  const sendLogs = async () => {
    setSendingLogs(true);
    try {
      const result = await submitLogs();
      Alert.alert(
        'Logs sent',
        `Thanks! Your reference number is #${result.id}. Mention it when you tell us what went wrong.`
      );
    } catch {
      Alert.alert('Could not send logs', 'Please check your connection and try again.');
    } finally {
      setSendingLogs(false);
    }
  };

  const confirmSendLogs = () => {
    Alert.alert(
      'Send app logs?',
      "This sends the app's recent activity log and basic device info (model, OS version) to the EagleEyes team to help fix bugs. It doesn't include your password.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send', onPress: sendLogs },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color="#00853E" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Help &amp; Support</Text>
      </View>

      <View style={styles.choices}>
        <TouchableOpacity
          style={styles.choice}
          onPress={() => router.push('/report-hazard')}
          activeOpacity={0.75}
        >
          <View style={styles.circleButton}>
            <Ionicons name="warning-outline" size={30} color="#E3A008" />
          </View>
          <Text style={styles.choiceText}>Report a Hazard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choice}
          onPress={() => router.push('/report-note')}
          activeOpacity={0.75}
        >
          <View style={styles.circleButton}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#3976B9" />
          </View>
          <Text style={styles.choiceText}>Note to Admin</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.choice}
          onPress={confirmSendLogs}
          disabled={sendingLogs}
          activeOpacity={0.75}
        >
          <View style={styles.circleButton}>
            {sendingLogs ? (
              <ActivityIndicator color="#00853E" />
            ) : (
              <Ionicons name="bug-outline" size={28} color="#00853E" />
            )}
          </View>
          <Text style={styles.choiceText}>{sendingLogs ? 'Sending…' : 'Send App Logs'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 35,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  backText: {
    color: '#00853E',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#00853E',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 12,
  },
  choices: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: 44,
    paddingHorizontal: 12,
  },
  choice: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  circleButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.95,
    borderColor: '#00853E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: {
    maxWidth: 140,
    color: '#30363B',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
