// Shared by LotPickerModal.tsx (native) and LotPickerModal.web.tsx: which lots
// the picker lists, nearest first, and how typed searches are matched/ranked.
import { useEffect, useMemo, useState } from 'react';
import { useLots } from '../context/LotsContext';
import { isLotClosed } from '../utils/lotStatus';
import { centroid, distanceMeters, LatLng } from '../utils/geo';
import { rankLotMatches } from '../utils/lotSearch';

export const UNT_CENTER: LatLng = { latitude: 33.2110, longitude: -97.1475 };

export type PickerLot = {
  // display name - what onSelect hands back, and what forms/closures key on
  name: string;
  // short code from LotsContext ("20", "UCG", ...), also searchable
  tag: string;
  fillColor: string;
  closed: boolean;
  // distance from the sort origin to the nearest of this lot's polygons
  distance: number;
  // middle of all its polygons - where the map pans to when it's picked
  center: LatLng;
};

/**
 * Picker lots, nearest first from the app's known location (else the picker's own fix,
 * else campus center). Fixed per opening; multi-zone lots are one row.
 */
export function useLotPickerList(visible: boolean, query: string, ownFix: LatLng | null) {
  const { lots, userLocation, updateUserLocation } = useLots();
  const [origin, setOrigin] = useState<LatLng | null>(null);

  // share the picker's own fix with the rest of the app
  useEffect(() => {
    if (ownFix) updateUserLocation(ownFix);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownFix?.latitude, ownFix?.longitude]);

  useEffect(() => {
    if (!visible) {
      setOrigin(null);
      return;
    }
    const known = userLocation ?? ownFix;
    if (known && !origin) setOrigin(known);
  }, [visible, userLocation, ownFix, origin]);

  const sortOrigin = origin ?? UNT_CENTER;

  const nearest = useMemo<PickerLot[]>(() => {
    const byName = new Map<string, { lot: any; distance: number; coords: LatLng[] }>();
    lots.forEach((lot: any) => {
      if (!Array.isArray(lot.coordinates) || lot.coordinates.length < 3 || !lot.name) return;
      const distance = distanceMeters(sortOrigin, centroid(lot.coordinates));
      const existing = byName.get(lot.name);
      if (!existing) {
        byName.set(lot.name, { lot, distance, coords: [...lot.coordinates] });
      } else {
        existing.coords.push(...lot.coordinates);
        if (distance < existing.distance) {
          existing.distance = distance;
          existing.lot = lot;
        }
      }
    });
    return Array.from(byName.values())
      .map(({ lot, distance, coords }) => ({
        name: lot.name,
        tag: lot.tag || '',
        fillColor: lot.fillColor || '#999',
        closed: isLotClosed(lot.lotStatus),
        distance,
        center: centroid(coords),
      }))
      .sort((a, b) => a.distance - b.distance);
    // keyed on the coordinates, not the object, so a new-but-equal origin doesn't re-sort
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lots, sortOrigin.latitude, sortOrigin.longitude]);

  const matches = useMemo<PickerLot[]>(() => {
    if (!query.trim()) return [];
    return rankLotMatches(nearest, query);
  }, [nearest, query]);

  return {
    // every polygon, for drawing the map
    polygons: lots.filter((lot: any) => Array.isArray(lot.coordinates) && lot.coordinates.length >= 3),
    nearest,
    matches,
    // false = sorted from campus center because no location is known yet
    hasLocation: origin !== null,
  };
}
