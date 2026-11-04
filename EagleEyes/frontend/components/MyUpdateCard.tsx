import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

//one entry from GET /users/me/notifications
export interface MyUpdate {
  id: number;
  kind: 'report_approved' | 'report_declined' | 'note_acknowledged' | string;
  source_type: string;
  source_id: number;
  title: string;
  body?: string | null;
  lot_name?: string | null;
  created_at: string;
  read_at?: string | null;
}

type KindVisual = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  bg: string;
  label: string;
};

//approved reads as good news, declined stays neutral grey (not alarming red),
//and a note acknowledgment is informational blue
const KIND_VISUALS: Record<string, KindVisual> = {
  report_approved: { icon: 'checkmark-circle', color: '#00853E', bg: '#E6F4EC', label: 'Report approved' },
  report_declined: { icon: 'close-circle', color: '#64748B', bg: '#F1F5F9', label: 'Report reviewed' },
  note_acknowledged: { icon: 'eye', color: '#2563EB', bg: '#EAF1FE', label: 'Note acknowledged' },
};
const FALLBACK_VISUAL: KindVisual = { icon: 'notifications', color: '#64748B', bg: '#F1F5F9', label: 'Update' };

export function getMyUpdateVisual(kind: string): KindVisual {
  return KIND_VISUALS[kind] ?? FALLBACK_VISUAL;
}

export default function MyUpdateCard({
  update,
  timeLabel,
  onPress,
}: {
  update: MyUpdate;
  //e.g. "2h" - formatted by the screen so it matches the alert cards
  timeLabel: string;
  onPress: () => void;
}) {
  const visual = getMyUpdateVisual(update.kind);
  const unread = !update.read_at;

  return (
    <TouchableOpacity
      style={[styles.card, unread && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${update.title}. ${update.body ?? ''}`}
      accessibilityHint={unread ? 'Marks this update as read' : undefined}
    >
      <View style={[styles.iconWrap, { backgroundColor: visual.bg }]}>
        <Ionicons name={visual.icon} size={26} color={visual.color} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          {unread && <View style={styles.unreadDot} />}
          <Text style={[styles.title, unread && styles.titleUnread]}>{update.title}</Text>
        </View>

        {!!update.body && <Text style={styles.text}>{update.body}</Text>}

        <View style={styles.metaRow}>
          {!!update.lot_name && (
            <View style={styles.metaItem}>
              <Ionicons name="location" size={13} color="#00853E" />
              <Text style={styles.lotText}>{update.lot_name}</Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color="#94A3B8" />
            <Text style={styles.timeText}>{timeLabel} ago</Text>
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
  body: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
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
  text: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#64748B',
    marginBottom: 6,
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
