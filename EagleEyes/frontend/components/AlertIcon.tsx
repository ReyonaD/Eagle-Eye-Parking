import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AlertVisual } from '../utils/alertVisuals';

// A hazard/event category's icon, drawn from whichever icon set it comes from
// (most are Ionicons; a few, like "item on road"'s traffic cone, are
// MaterialCommunityIcons - see iconFamily in utils/alertVisuals.ts).
export default function AlertIcon({ visual, size, color }: { visual: AlertVisual; size: number; color?: string }) {
  const iconColor = color ?? visual.iconColor;
  if (visual.iconFamily === 'materialCommunity') {
    return <MaterialCommunityIcons name={visual.icon as any} size={size} color={iconColor} />;
  }
  return <Ionicons name={visual.icon as any} size={size} color={iconColor} />;
}
