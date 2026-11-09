import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AlertVisual } from '../utils/alertVisuals';

// A category's icon, from Ionicons or MaterialCommunityIcons (see alertVisuals iconFamily).
export default function AlertIcon({ visual, size, color }: { visual: AlertVisual; size: number; color?: string }) {
  const iconColor = color ?? visual.iconColor;
  if (visual.iconFamily === 'materialCommunity') {
    return <MaterialCommunityIcons name={visual.icon as any} size={size} color={iconColor} />;
  }
  return <Ionicons name={visual.icon as any} size={size} color={iconColor} />;
}
