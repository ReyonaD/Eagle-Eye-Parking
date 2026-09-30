import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface InitialsAvatarProps {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// "Jane Doe" -> "JD", "Test5" -> "T". Falls back to blank (caller shows a
// generic icon instead) when the account has no name set yet.
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Same light-green/UNT-green treatment used everywhere else in the app,
// rather than a per-user color hash, so admin and commuter avatars still
// read as the same visual system.
export default function InitialsAvatar({ name, size = 96, style }: InitialsAvatarProps) {
  const initials = getInitials(name);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {initials ? (
        <Text style={[styles.text, { fontSize: size * 0.38 }]}>{initials}</Text>
      ) : (
        <Ionicons name="person-circle" size={size * 0.28} color="#00853E" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: '#e8f5ee',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: '#00853E',
    fontWeight: '800',
  },
});
