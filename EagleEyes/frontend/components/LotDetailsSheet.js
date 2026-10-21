import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openDirections } from '../utils/navigation';
import { getPermitCardStyle } from '../utils/permitColors';
import { getPremiumParkingLink, dedupePermitLabels } from '../utils/permits';
import { getLotStatusItems, getLotTakeover } from '../utils/lotStatus';
import PermitHoursList from './PermitHoursList';
import AlertIcon from './AlertIcon';

const STATUS_COLOR = {
  'Available': '#00853E',
  'Near Capacity': '#F5A623',
  'Full': '#D0021B',
  'Closed': '#374151',
  'No Data': '#808080',
};

function formatLotTimestamp(value) {
  if (!value) return 'No time available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No time available';
  return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

//one label/value line inside the sheet
function InfoRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color="#00853E" style={styles.infoIcon} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

//bottom sheet with the lot's real details, used when tapping a lot on the map
export default function LotDetailsSheet({ lot, visible, onClose }) {
  if (!lot) return null;

  //a closure or event in progress: show just the lot and what's going on
  const takeover = getLotTakeover(lot.lotStatus);
  const statusLabel = takeover ? takeover.label : (lot.status || 'Available');
  const statusColor = takeover
    ? (takeover.label === 'Closed' ? STATUS_COLOR['Closed'] : takeover.visual.iconColor)
    : STATUS_COLOR[lot.status] || STATUS_COLOR['No Data'];
  const rawPermits = Array.isArray(lot.permitList) && lot.permitList.length > 0
    ? lot.permitList
    : (typeof lot.permits === 'string' ? lot.permits.split(',') : []);
  const permits = dedupePermitLabels(rawPermits);
  const hasParkzenCaptureTime = lot.sourceTimestampProvidedByParkzen === true;
  const captureTimeValue = hasParkzenCaptureTime ? formatLotTimestamp(lot.lastUpdatedAt) : 'No time available';
  const premiumParkingLink = getPremiumParkingLink(lot.name, lot.permitList, lot.coordinates);
  const statusItems = getLotStatusItems(lot.lotStatus);
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      {/* dark backdrop, tap to close */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Text style={styles.lotName} numberOfLines={2}>{lot.name}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '1A' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {statusItems.length > 0 && (
          <View style={styles.alertsBlock}>
            {statusItems.map((item) => (
              <View key={item.key} style={styles.alertRow}>
                <View style={[styles.alertIcon, { backgroundColor: item.visual.bg }]}>
                  <AlertIcon visual={item.visual} size={18} />
                </View>
                <View style={styles.alertTextCol}>
                  <Text style={styles.alertTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.alertDetail} numberOfLines={1}>{item.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {!takeover && (
          <>
            <InfoRow
              icon="speedometer-outline"
              label="Occupancy"
              value={typeof lot.percentEmpty === 'number' ? `${lot.percentEmpty}% empty` : 'No data'}
            />
            <InfoRow
              icon="time-outline"
              label="ParkZen capture time"
              value={captureTimeValue}
            />
            <InfoRow
              icon="car-outline"
              label="Capacity"
              value={lot.capacity ? `${lot.capacity} spaces` : null}
            />
            <InfoRow icon="location-outline" label="Address" value={lot.address} />

            {permits.length > 0 && (
              <View style={styles.permitsBlock}>
                <Text style={styles.permitsTitle}>Permits</Text>
                <ScrollView style={styles.permitsScroll} contentContainerStyle={styles.permitsWrap}>
                  {permits.map((label, i) => {
                    const permitStyle = getPermitCardStyle(label);
                    const borderStyle = permitStyle.border
                      ? { borderWidth: 1, borderColor: permitStyle.border }
                      : null;
                    return (
                      <View key={i} style={[styles.permitChip, { backgroundColor: permitStyle.bg }, borderStyle]}>
                        <Text style={[styles.permitChipText, { color: permitStyle.text }]}>{label}</Text>
                      </View>
                    );
                  })}
                </ScrollView>
                <PermitHoursList permits={permits} />
              </View>
            )}

            {premiumParkingLink && (
              <TouchableOpacity
                style={styles.payButton}
                onPress={() => Linking.openURL(premiumParkingLink)}
              >
                <Text style={styles.directionsText}>Premium Parking</Text>
                <Ionicons name="open-outline" size={22} color="#fff" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.directionsButton}
              onPress={() => { onClose(); openDirections(lot); }}
            >
              <Ionicons name="navigate" size={22} color="#fff" />
              <Text style={styles.directionsText}>Get Directions</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  lotName: { fontSize: 20, fontWeight: 'bold', color: '#333', flex: 1, marginRight: 10 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 13, fontWeight: '600' },
  alertsBlock: { marginBottom: 8, gap: 8 },
  alertRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 10, padding: 8 },
  alertIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  alertTextCol: { flex: 1 },
  alertTitle: { fontSize: 14, fontWeight: '700', color: '#333' },
  alertDetail: { fontSize: 12, color: '#777', marginTop: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  infoIcon: { marginRight: 10 },
  infoLabel: { fontSize: 14, color: '#777', width: 80 },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '500', flex: 1, textAlign: 'right' },
  permitsBlock: { marginTop: 8 },
  permitsTitle: { fontSize: 14, color: '#777', marginBottom: 8 },
  permitsScroll: { maxHeight: 240 },
  permitsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  permitChip: { backgroundColor: '#f0f0f0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' },
  permitChipText: { fontSize: 12, color: '#555', fontWeight: '500' },
  payButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#D6332A', height: 50, borderRadius: 10, marginTop: 18, gap: 8,
  },
  directionsButton: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#00853E', height: 50, borderRadius: 10, marginTop: 10, gap: 8,
  },
  directionsText: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
});
