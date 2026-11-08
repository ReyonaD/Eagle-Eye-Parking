import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

//one entry from GET /users/me/notes
export interface MyNote {
  id: number;
  title: string;
  lot_name?: string | null;
  created_at: string;
  //null = the parking team hasn't acknowledged it yet
  acknowledged_at?: string | null;
}

//one entry from GET /users/me/notifications - only used to know which
//acknowledgments the commuter hasn't seen yet (the unread dot)
export interface NoteAcknowledgment {
  id: number;
  source_type: string;
  source_id: number;
  read_at?: string | null;
}

export default function NoteStatusCard({
  note,
  unread,
  sentLabel,
  acknowledgedLabel,
  onPress,
}: {
  note: MyNote;
  //acknowledged since the commuter last looked
  unread: boolean;
  //e.g. "2h" - formatted by the screen so it matches the alert cards
  sentLabel: string;
  acknowledgedLabel?: string;
  onPress: () => void;
}) {
  const acknowledged = !!note.acknowledged_at;
  const statusText = acknowledged ? 'Acknowledged' : 'Pending';

  return (
    <TouchableOpacity
      style={[styles.card, unread && styles.cardUnread]}
      onPress={onPress}
      disabled={!unread}
      activeOpacity={0.7}
      accessibilityRole={unread ? 'button' : undefined}
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${note.title}. ${statusText}.`}
      accessibilityHint={unread ? 'Marks this as read' : undefined}
    >
      <View style={[styles.iconWrap, acknowledged ? styles.iconAck : styles.iconPending]}>
        <Ionicons
          name={acknowledged ? 'eye' : 'time-outline'}
          size={24}
          color={acknowledged ? '#2563EB' : '#B45309'}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {unread && <View style={styles.unreadDot} />}
          <Text style={[styles.title, unread && styles.titleUnread]} numberOfLines={2}>
            {note.title}
          </Text>
        </View>

        <View style={[styles.statusPill, acknowledged ? styles.pillAck : styles.pillPending]}>
          <Text style={[styles.statusText, acknowledged ? styles.statusTextAck : styles.statusTextPending]}>
            {acknowledged && acknowledgedLabel ? `${statusText} ${acknowledgedLabel} ago` : statusText}
          </Text>
        </View>

        <View style={styles.metaRow}>
          {!!note.lot_name && (
            <View style={styles.metaItem}>
              <Ionicons name="location" size={13} color="#00853E" />
              <Text style={styles.lotText}>{note.lot_name}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="paper-plane-outline" size={13} color="#94A3B8" />
            <Text style={styles.timeText}>Sent {sentLabel} ago</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  //same card shape as the Alerts screen's AlertCard so the tabs feel like one list
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardUnread: {
    backgroundColor: '#F4FBF7',
    borderColor: '#CDEBD9',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  iconPending: {
    backgroundColor: '#FEF3C7',
  },
  iconAck: {
    backgroundColor: '#EAF1FE',
  },
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E02D2D',
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 20,
  },
  titleUnread: {
    fontWeight: '800',
    color: '#1E293B',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 6,
  },
  pillPending: {
    backgroundColor: '#FEF3C7',
  },
  pillAck: {
    backgroundColor: '#EAF1FE',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextPending: {
    color: '#B45309',
  },
  statusTextAck: {
    color: '#2563EB',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 12,
    rowGap: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lotText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#00853E',
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
