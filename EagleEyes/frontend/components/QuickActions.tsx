import React, { useState } from 'react';
import { View, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IS_WEB = Platform.OS === 'web';
const SIZE = 36;
const GAP = 8;

export type QuickAction = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone: 'approve' | 'decline' | 'neutral';
  onPress: () => void;
};

const TONE_COLORS = { approve: '#00853E', decline: '#E74C3C', neutral: '#6B7280' };

//hover state for a card (web only; touch devices never hover). Uses mouse enter/leave,
//not Pressable's onHoverIn/Out: RN Web ends a Pressable's hover as soon as the pointer
//enters a nested Pressable, which would hide these buttons the moment you reach them
export function useHover() {
  const [hovered, setHovered] = useState(false);
  const hoverProps: any = { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) };
  return { hovered, hoverProps };
}

//round icon buttons on the right edge of a card, shown while it's hovered (web only).
//the column's width is always reserved, so hovering never moves or covers the card's text
export function QuickActions({ visible, actions, busy = false }: {
  visible: boolean;
  actions?: QuickAction[];
  busy?: boolean;
}) {
  if (!IS_WEB || !actions?.length) return null;
  const width = actions.length * SIZE + (actions.length - 1) * GAP;
  const show = visible && !busy;
  return (
    <View style={[styles.column, { width }]} pointerEvents={show ? 'auto' : 'none'}>
      {busy ? (
        <ActivityIndicator size="small" color="#00853E" />
      ) : (
        actions.map(action => (
          <Pressable
            key={action.label}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            //browser tooltip, so icon-only buttons still say what they do (ref is the DOM node on web)
            ref={(node: any) => node?.setAttribute?.('title', action.label)}
            style={({ hovered }: any) => [
              styles.button,
              { borderColor: TONE_COLORS[action.tone], opacity: show ? 1 : 0 },
              hovered && { backgroundColor: TONE_COLORS[action.tone] },
            ]}
          >
            {({ hovered }: any) => (
              <Ionicons name={action.icon} size={20} color={hovered ? '#fff' : TONE_COLORS[action.tone]} />
            )}
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: GAP, marginLeft: 10 },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
