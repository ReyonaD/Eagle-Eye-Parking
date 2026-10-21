import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLots } from '../context/LotsContext';
import { formatPermitHours, isAnyTimePermit, lookupPermitHours } from '../utils/permitHours';

// Under a lot's permits: the hours for any permit that can't park here around
// the clock (e.g. Evening, 3:30 PM – 7:00 AM), straight from ParkZen. Permits
// allowed any time aren't listed one by one - the footer line covers them.
export default function PermitHoursList({ permits }: { permits: string[] }) {
  const { permitHours } = useLots();

  const restricted = permits
    .map((label) => ({ label, hours: lookupPermitHours(permitHours, label) }))
    .filter((entry): entry is { label: string; hours: NonNullable<typeof entry.hours> } =>
      !!entry.hours && !isAnyTimePermit(entry.hours));
  if (restricted.length === 0) return null;

  const hasAnyTimePermits = restricted.length < permits.length;

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Permit hours</Text>
      {restricted.map(({ label, hours }) => (
        <View key={label} style={styles.row}>
          <Ionicons name="time-outline" size={16} color="#00853E" style={styles.icon} />
          <View style={styles.textCol}>
            <Text style={styles.permit}>{label}</Text>
            {formatPermitHours(hours).map((line) => (
              <Text key={line.days} style={styles.hours}>
                {line.days === 'Daily' ? `Daily, ${line.hours}` : `${line.days}: ${line.hours}`}
              </Text>
            ))}
          </View>
        </View>
      ))}
      {hasAnyTimePermits && <Text style={styles.footer}>All other permits here: any time</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 12, gap: 8 },
  title: { fontSize: 14, color: '#777' },
  row: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#f8faf9', borderRadius: 10, padding: 8 },
  icon: { marginRight: 8, marginTop: 1 },
  textCol: { flex: 1 },
  permit: { fontSize: 14, fontWeight: '700', color: '#333' },
  hours: { fontSize: 13, color: '#555', marginTop: 2 },
  footer: { fontSize: 12, color: '#999' },
});
