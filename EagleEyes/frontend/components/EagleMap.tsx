import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated, Easing, AccessibilityInfo } from 'react-native';
import MapView, { Marker, Polygon, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import LotDetailsSheet from './LotDetailsSheet';
import { Ionicons } from '@expo/vector-icons';
import { nearestLotDistance, NEARBY_LOT_THRESHOLD_METERS, NEARBY_ZOOM_DELTA, getStripeSegments } from '../utils/geo';
import { getLotStatusIcons, isLotClosed, getActiveEvent, CLOSURE_CATEGORY, CLOSED_STRIPE_WIDTH } from '../utils/lotStatus';
import { getEventVisual } from '../utils/alertVisuals';
import { LIGHT_MAP_STYLE, DARK_MAP_STYLE, getClosedLotColors, getLotStrokeColor, getLotFillOpacity } from '../utils/mapStyles';

interface EagleMapProps {
  liveLots: any[];
  selectedCampus?: string;
  mapType?: 'standard' | 'satellite';
  darkMap?: boolean;
}

const CAMPUS_REGIONS: Record<string, { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number }> = {
  "Main campus":     { latitude: 33.2110, longitude: -97.1475, latitudeDelta: 0.018, longitudeDelta: 0.018 },
  "Discovery Park":  { latitude: 33.2549, longitude: -97.1520, latitudeDelta: 0.018, longitudeDelta: 0.018 },
  "Frisco Landing":  { latitude: 33.1858, longitude: -96.8055, latitudeDelta: 0.018, longitudeDelta: 0.018 },
};

function withFillOpacity(color: string, opacity: number): string {
  const hexMatch = /^#([0-9a-f]{6})$/i.exec(color || '');
  if (!hexMatch) return color;
  const value = parseInt(hexMatch[1], 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function getLotNumberLabel(lot: any): string {
  const rawName = String(lot?.name || lot?.lot_name || '').trim();
  const rawTag = String(lot?.tag || '').trim();
  const rawId = String(lot?.id || '').trim();
  const combined = `${rawName} ${rawTag} ${rawId}`.toLowerCase();

  if (combined.includes('highland') && combined.includes('garage')) return 'HSG';
  if (combined.includes('union circle') && combined.includes('garage')) return 'UCG';
  if (combined === 'hsg' || rawId.toLowerCase() === 'hsg' || rawTag.toUpperCase() === 'HSG') return 'HSG';
  if (combined.includes('ucg') || rawTag.toUpperCase() === 'UCG' || rawId.toLowerCase() === 'ucg') return 'UCG';

  const match = /lot\s*(\d+)/i.exec(rawName);
  if (match) return `Lot ${match[1]}`;

  if (/^\d+$/.test(rawTag)) return `Lot ${rawTag}`;
  if (/^\d+$/.test(rawId)) return `Lot ${rawId}`;

  return '';
}

// A closed lot is shown by striping the lot itself, not a badge icon - quieter
// on a freshly opened map - so the closure's lock is left out of its badge.
const CLOSURE_VISUAL_ICON = getEventVisual(CLOSURE_CATEGORY).icon;
const getMapStatusIcons = (status: any) =>
  getLotStatusIcons(status).filter((visual) => visual.icon !== CLOSURE_VISUAL_ICON);

// Event/hazard icons pop once - a quick scale-up and settle - the first time
// each one shows up on a lot this session, so a new report catches the eye
// without the map moving constantly. Module-level so it survives the map tab
// remounting; skipped entirely when the phone has Reduce Motion on.
const poppedIconKeys = new Set<string>();
let reduceMotionEnabled = false;
AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => { reduceMotionEnabled = enabled; })
  .catch(() => {});
AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => { reduceMotionEnabled = enabled; });

function PopIn({ popKey, children }: { popKey: string; children: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (poppedIconKeys.has(popKey)) return;
    poppedIconKeys.add(popKey);
    if (reduceMotionEnabled) return;

    scale.setValue(0.4);
    // JS-driven (not useNativeDriver) so the marker, which the Google map
    // renders as a snapshot of this view, actually redraws each frame.
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.15, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: false }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: false }),
    ]).start();
  }, [popKey, scale]);

  return <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>;
}

// How much of a closure/event/hazard badge to draw, from how big the lot is
// on screen right now, so a badge never spills over neighboring lots when the
// user zooms out: the full pill (every icon) when the lot has room,
// then just the most important icon, then a small dot.
type BadgeSize = 'full' | 'compact' | 'dot';
const BADGE_ICON_PX: Record<BadgeSize, number> = { full: 22, compact: 18, dot: 12 };
const BADGE_ICON_GLYPH_PX: Record<BadgeSize, number> = { full: 14, compact: 12, dot: 8 };

function pickBadgeSize(
  lotScreenSize: { width: number; height: number },
  iconCount: number,
): BadgeSize {
  // padding 3 + border 1 on each side, icons 3px apart
  const fullWidth = 8 + iconCount * BADGE_ICON_PX.full + (iconCount - 1) * 3;
  if (fullWidth <= lotScreenSize.width && BADGE_ICON_PX.full + 8 <= lotScreenSize.height) return 'full';
  const compactSide = BADGE_ICON_PX.compact + 8;
  if (compactSide <= lotScreenSize.width && compactSide <= lotScreenSize.height) return 'compact';
  return 'dot';
}

// Breathing room around a lot's number/badge, so it never touches the lot's
// edge (the text width is only an estimate from its character count).
const LABEL_FIT_MARGIN = 1.15;

// Screen size of a lot's marker: its number label, its status badge stacked
// above it, or both.
type MarkerBox = { width: number; height: number };
function getMarkerBox(label: string, fontSize: number, badge: { size: BadgeSize; iconCount: number } | null): MarkerBox {
  const textWidth = label ? label.length * fontSize * 0.68 + 8 : 0;
  const textHeight = label ? fontSize + 6 : 0;
  let badgeWidth = 0;
  let badgeHeight = 0;
  if (badge) {
    const iconPx = BADGE_ICON_PX[badge.size];
    // padding 3 + border 1 on each side (padding 1 for a dot), icons 3px apart
    const chrome = badge.size === 'dot' ? 4 : 8;
    badgeWidth = chrome + badge.iconCount * iconPx + (badge.iconCount - 1) * 3;
    badgeHeight = chrome + iconPx;
  }
  return {
    width: Math.max(textWidth, badgeWidth) * LABEL_FIT_MARGIN,
    height: (textHeight + badgeHeight + (label && badge ? 2 : 0)) * LABEL_FIT_MARGIN,
  };
}

// The lot's bounding box in screen pixels at the current zoom.
function getLotScreenSize(
  coordinates: { latitude: number; longitude: number }[],
  mapSize: { width: number; height: number },
  region: { latitudeDelta: number; longitudeDelta: number },
) {
  if (!coordinates.length || !region.latitudeDelta || !region.longitudeDelta) return { width: 0, height: 0 };
  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  return {
    width: ((Math.max(...longitudes) - Math.min(...longitudes)) / region.longitudeDelta) * mapSize.width,
    height: ((Math.max(...latitudes) - Math.min(...latitudes)) / region.latitudeDelta) * mapSize.height,
  };
}

function pointInPolygon(point: { latitude: number; longitude: number }, polygon: { latitude: number; longitude: number }[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersects =
      ((yi > point.longitude) !== (yj > point.longitude)) &&
      (point.latitude < ((xj - xi) * (point.longitude - yi)) / ((yj - yi) || 1) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

function getPolygonCenter(coordinates: { latitude: number; longitude: number }[]) {
  if (coordinates.length === 0) return null;

  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);

  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  };
}

function doesBoxFitLot(
  box: MarkerBox,
  coordinate: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[],
  mapSize: { width: number; height: number },
  region: { latitudeDelta: number; longitudeDelta: number },
) {
  if (!mapSize.width || !mapSize.height || !region.latitudeDelta || !region.longitudeDelta) return false;

  const halfLatitude = (box.height / 2) * region.latitudeDelta / mapSize.height;
  const halfLongitude = (box.width / 2) * region.longitudeDelta / mapSize.width;

  for (let row = 0; row <= 2; row++) {
    for (let column = 0; column <= 4; column++) {
      const point = {
        latitude: coordinate.latitude + (1 - row) * halfLatitude,
        longitude: coordinate.longitude + (column / 2 - 1) * halfLongitude,
      };
      if (!pointInPolygon(point, polygon)) return false;
    }
  }

  return true;
}

// The spot closest to the lot's middle where the whole marker fits inside the
// lot, or null if it fits nowhere (the marker is then hidden, never overflows).
function getLotLabelCoordinate(
  coordinates: { latitude: number; longitude: number }[],
  box: MarkerBox,
  mapSize: { width: number; height: number },
  region: { latitudeDelta: number; longitudeDelta: number },
) {
  if (!coordinates || coordinates.length === 0) return null;

  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  const latStep = (maxLat - minLat) / 10;
  const lngStep = (maxLng - minLng) / 10;
  const candidates: { latitude: number; longitude: number }[] = [];

  for (let row = 1; row <= 9; row++) {
    for (let col = 1; col <= 9; col++) {
      const latitude = minLat + row * latStep;
      const longitude = minLng + col * lngStep;
      candidates.push({ latitude, longitude });
    }
  }

  const fittingCandidates = candidates.filter((point) =>
    pointInPolygon(point, coordinates) &&
    doesBoxFitLot(box, point, coordinates, mapSize, region)
  );

  return fittingCandidates.sort((a, b) => {
    const distanceA = Math.abs(a.latitude - centerLat) + Math.abs(a.longitude - centerLng);
    const distanceB = Math.abs(b.latitude - centerLat) + Math.abs(b.longitude - centerLng);
    return distanceA - distanceB;
  })[0] || null;
}

export default function EagleMap({ liveLots, selectedCampus = "Main campus", mapType = "standard", darkMap = false }: EagleMapProps) {
  // Satellite imagery is dark too, so it gets the same lighter overlay shades.
  const darkSurface = darkMap || mapType === 'satellite';
  const closedColors = getClosedLotColors(darkSurface);
  const lotFill = (lot: any) => (isLotClosed(lot.lotStatus) ? closedColors.fill : lot.fillColor);
  const lotStroke = (lot: any) =>
    isLotClosed(lot.lotStatus) ? closedColors.stroke : getLotStrokeColor(lot.strokeColor, darkSurface);

  const mapRef = useRef<MapView>(null);
  const untRegion = CAMPUS_REGIONS["Main campus"];
  const [sheetLot, setSheetLot] = useState<any | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitudeDelta: untRegion.latitudeDelta,
    longitudeDelta: untRegion.longitudeDelta,
  });
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  // Lot numbers and badges are fixed-size, so mid-pinch they'd outgrow (or
  // drift off) lots that are shrinking with the map. They're hidden while a
  // zoom is in progress and re-fitted once it settles. Plain panning keeps them.
  const [isZooming, setIsZooming] = useState(false);
  const isZoomingRef = useRef(false);

  // Map lifecycle logging, captured by utils/logCapture for "Send App Logs".
  // A bad/restricted Google Maps API key only shows up natively (logcat), but
  // from JS it looks like: onMapReady fires, onMapLoaded never does.
  const mapLoadedRef = useRef(false);
  const mapLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    console.log('[EagleMap] mounted | provider: google | mapType:', mapType, '| lots:', liveLots.length);
    return () => {
      if (mapLoadTimeoutRef.current) clearTimeout(mapLoadTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMapReady = () => {
    console.log('[EagleMap] onMapReady | size:', mapSize.width, 'x', mapSize.height);
    if (mapLoadTimeoutRef.current) clearTimeout(mapLoadTimeoutRef.current);
    mapLoadTimeoutRef.current = setTimeout(() => {
      if (!mapLoadedRef.current) {
        console.warn('[EagleMap] map tiles did not finish loading within 15s of onMapReady - likely an invalid/restricted Google Maps API key or no network');
      }
    }, 15000);
  };

  const handleMapLoaded = () => {
    mapLoadedRef.current = true;
    console.log('[EagleMap] onMapLoaded (tiles rendered)');
  };

  useEffect(() => {
    const region = CAMPUS_REGIONS[selectedCampus];
    if (region) {
      mapRef.current?.animateToRegion(region, 800);
    }
  }, [selectedCampus]);

  // On app entry, if the user is near a lot, zoom in on them instead of the
  // default campus-wide view. Runs once, off the map's own first location
  // fix (same pattern LotPickerModal already uses) rather than a separate
  // permission/geolocation call.
  const hasAutoZoomedRef = useRef(false);
  const liveLotsRef = useRef(liveLots);
  liveLotsRef.current = liveLots;

  const handleUserLocationChange = (event: any) => {
    if (hasAutoZoomedRef.current) return;
    const coordinate = event?.nativeEvent?.coordinate;
    if (!coordinate) return;
    hasAutoZoomedRef.current = true;

    const userLoc = { latitude: coordinate.latitude, longitude: coordinate.longitude };
    const distance = nearestLotDistance(userLoc, liveLotsRef.current || []);
    if (distance <= NEARBY_LOT_THRESHOLD_METERS) {
      mapRef.current?.animateToRegion({
        latitude: userLoc.latitude,
        longitude: userLoc.longitude,
        latitudeDelta: NEARBY_ZOOM_DELTA,
        longitudeDelta: NEARBY_ZOOM_DELTA,
      }, 800);
    }
    // Otherwise the user is far from campus — leave the default Main Campus view.
  };

  const handleZoomIn = async () => {
    if (!mapRef.current) return;
    const camera = await mapRef.current.getCamera();
    if (camera && camera.zoom !== undefined) {
      mapRef.current.animateCamera({ zoom: camera.zoom + 1 }, { duration: 300 });
    }
  };

  const handleZoomOut = async () => {
    if (!mapRef.current) return;
    const camera = await mapRef.current.getCamera();
    if (camera && camera.zoom !== undefined) {
      mapRef.current.animateCamera({ zoom: camera.zoom - 1 }, { duration: 300 });
    }
  };

  const labelFontSize = Math.round(Math.max(10, Math.min(15, 15 - mapRegion.latitudeDelta * 500)));

  const lot20LabelId = useMemo(() => {
    const lot20Zones = liveLots.filter(
      (lot) => lot.isVisible !== false && getLotNumberLabel(lot) === 'Lot 20',
    );
    const lot20LabelLot = lot20Zones.find((lot) =>
      getLotLabelCoordinate(lot.coordinates || [], getMarkerBox('Lot 20', labelFontSize, null), mapSize, mapRegion),
    ) || lot20Zones[0];
    return lot20LabelLot?.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLots, labelFontSize, mapSize.width, mapSize.height, mapRegion.latitudeDelta, mapRegion.longitudeDelta]);

  // A lot split into several polygons (e.g. Lot 20's zones) shares one status,
  // so only one of its polygons carries the closure/event/hazard badge.
  const statusBadgeLotIds = useMemo(() => {
    const ownerByName: Record<string, string> = {};
    liveLots.forEach((lot) => {
      if (lot.isVisible === false || getMapStatusIcons(lot.lotStatus).length === 0) return;
      if (!ownerByName[lot.name] || lot.id === lot20LabelId) ownerByName[lot.name] = lot.id;
    });
    return new Set(Object.values(ownerByName));
  }, [liveLots, lot20LabelId]);

  // Diagonal stripes over each closed lot. Spaced in meters, not pixels, so
  // these Polylines only mount/unmount when a closure starts or ends - never
  // while the user is pinching (see the Marker note below).
  const closedLotStripes = useMemo(() => liveLots.flatMap((lot) => {
    if (lot.isVisible === false || !isLotClosed(lot.lotStatus)) return [];
    return getStripeSegments(lot.coordinates || []).map((segment, index) => ({
      key: `${lot.id}-stripe-${index}`,
      coordinates: segment,
    }));
  }), [liveLots]);

  // Every lot gets exactly one Marker (its number label and/or status badge),
  // mounted for as long as the lot exists. Zooming or a status change only
  // toggles `visible` (via opacity) and moves the coordinate. Mounting/unmounting
  // Markers while the user pinches crashes the native Google map on the New
  // Architecture (react-native-maps legacy interop), which kicked users back to
  // the home screen.
  const lotLabels = useMemo(() => {
    const labelsHidden = mapRegion.latitudeDelta > 0.01;

    return liveLots.reduce<{
      lot: any;
      lotName: string;
      coordinate: { latitude: number; longitude: number };
      visible: boolean;
      labelVisible: boolean;
      statusIcons: ReturnType<typeof getMapStatusIcons>;
      badgeSize: BadgeSize;
    }[]>((acc, lot) => {
      const lotName = getLotNumberLabel(lot);

      const center = getPolygonCenter(lot.coordinates || []);
      if (!center) return acc;

      // Status badges stay up at every zoom level - a closure or hazard matters
      // most when looking at the whole campus - but shrink to fit the lot.
      const allStatusIcons = statusBadgeLotIds.has(lot.id) ? getMapStatusIcons(lot.lotStatus) : [];
      const badgeSize = allStatusIcons.length > 0
        ? pickBadgeSize(getLotScreenSize(lot.coordinates || [], mapSize, mapRegion), allStatusIcons.length)
        : 'full';
      // icons come most important first, so the smaller sizes keep the event one
      const statusIcons = badgeSize === 'full' ? allStatusIcons : allStatusIcons.slice(0, 1);
      const badge = statusIcons.length > 0 ? { size: badgeSize, iconCount: statusIcons.length } : null;

      let labelVisible = !!lotName && !labelsHidden && lot.isVisible !== false;
      // Lot 20's zones share one number, shown on whichever zone fits it
      if (lotName === 'Lot 20' && lot.id !== lot20LabelId) labelVisible = false;
      // a dot-sized badge has no room for the lot number beside it
      if (badgeSize === 'dot') labelVisible = false;

      // The number (with any badge above it) only shows where all of it fits
      // inside the lot; otherwise it's hidden rather than spilling over.
      const labelCoordinate = labelVisible
        ? getLotLabelCoordinate(lot.coordinates || [], getMarkerBox(lotName, labelFontSize, badge), mapSize, mapRegion)
        : null;
      if (!labelCoordinate) labelVisible = false;

      // A badge on its own is never hidden; it takes the best spot it fits, or
      // the lot's middle.
      const badgeCoordinate = !labelVisible && badge
        ? getLotLabelCoordinate(lot.coordinates || [], getMarkerBox('', labelFontSize, badge), mapSize, mapRegion)
        : null;
      const coordinate = labelCoordinate || badgeCoordinate || center;
      const visible = labelVisible || statusIcons.length > 0;

      acc.push({ lot, lotName, coordinate, visible, labelVisible, statusIcons, badgeSize });
      return acc;
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLots, labelFontSize, mapSize.width, mapSize.height, mapRegion.latitudeDelta, mapRegion.longitudeDelta, lot20LabelId, statusBadgeLotIds]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        mapType={mapType}
        initialRegion={untRegion}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          if (width === 0 || height === 0) console.warn('[EagleMap] map laid out with zero size:', width, 'x', height);
          setMapSize(event.nativeEvent.layout);
        }}
        onMapReady={handleMapReady}
        onMapLoaded={handleMapLoaded}
        onRegionChange={(region) => {
          if (isZoomingRef.current || !mapRegion.latitudeDelta) return;
          // more than a 2% change in span = a zoom, not just a pan
          if (Math.abs(region.latitudeDelta - mapRegion.latitudeDelta) / mapRegion.latitudeDelta > 0.02) {
            isZoomingRef.current = true;
            setIsZooming(true);
          }
        }}
        onRegionChangeComplete={(region) => {
          setMapRegion((prev) => {
            const unchanged =
              Math.abs(prev.latitudeDelta - region.latitudeDelta) < 1e-7 &&
              Math.abs(prev.longitudeDelta - region.longitudeDelta) < 1e-7;
            if (unchanged) return prev;
            return {
              latitudeDelta: region.latitudeDelta,
              longitudeDelta: region.longitudeDelta,
            };
          });
          if (isZoomingRef.current) {
            isZoomingRef.current = false;
            setIsZooming(false);
          }
        }}
        showsUserLocation={true}
        onUserLocationChange={handleUserLocationChange}
        customMapStyle={darkMap ? DARK_MAP_STYLE : LIGHT_MAP_STYLE}
      >
        {liveLots.length > 0 && liveLots.map((lot) => (
          <Polygon
            key={lot.id}
            coordinates={lot.coordinates}
            fillColor={lot.isVisible === false ? 'rgba(0,0,0,0)' : withFillOpacity(lotFill(lot), getLotFillOpacity(darkMap))}
            strokeColor={lot.isVisible === false ? 'rgba(0,0,0,0)' : lotStroke(lot)}
            // a closed lot's dark fill already marks it; only an event in progress
            // needs the thicker outline in its color
            strokeWidth={lot.isVisible === false ? 0 : (getActiveEvent(lot.lotStatus) && !isLotClosed(lot.lotStatus) ? 4 : 2)}
            tappable={lot.isVisible !== false}
            onPress={() => {
              if (lot.isVisible === false) return;
              setSheetLot(lot);
            }}
          />
        ))}
        {closedLotStripes.map((stripe) => (
          <Polyline
            key={stripe.key}
            coordinates={stripe.coordinates}
            strokeColor={closedColors.stripe}
            strokeWidth={CLOSED_STRIPE_WIDTH}
            tappable={false}
          />
        ))}
        {lotLabels.map(({ lot, lotName, coordinate, visible, labelVisible, statusIcons, badgeSize }) => (
          <Marker
            key={`${lot.id}-label`}
            coordinate={coordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            opacity={visible && !isZooming ? 1 : 0}
            tappable={visible && !isZooming}
            onPress={() => {
              if (!visible) return;
              setSheetLot(lot);
            }}
          >
            <View style={styles.lotLabel}>
              {statusIcons.length > 0 && (
                <View style={[styles.statusBadge, badgeSize === 'dot' && styles.statusBadgeDot]}>
                  {statusIcons.map((visual) => {
                    const iconPx = BADGE_ICON_PX[badgeSize];
                    return (
                      // keyed by lot name, not polygon id, so a lot's badge moving
                      // between its zones (e.g. Lot 20) doesn't pop it again
                      <PopIn key={visual.icon} popKey={`${lot.name}:${visual.icon}`}>
                        <View
                          style={[styles.statusIcon, { width: iconPx, height: iconPx, borderRadius: iconPx / 2, backgroundColor: visual.bg }]}
                        >
                          <Ionicons name={visual.icon as any} size={BADGE_ICON_GLYPH_PX[badgeSize]} color={visual.iconColor} />
                        </View>
                      </PopIn>
                    );
                  })}
                </View>
              )}
              {labelVisible && (
                <Text style={{
                  color: lotStroke(lot) || lotFill(lot) || (darkSurface ? '#e5e5e5' : '#1f1f1f'),
                  fontSize: labelFontSize,
                  // semi-bold, not heavy, so lot numbers don't outweigh the
                  // map's own street/building names; the halo below keeps the
                  // lighter text readable over lot fills and roads
                  fontWeight: '600',
                  textShadowColor: darkSurface ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)',
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 2,
                  lineHeight: labelFontSize + 2,
                  textAlign: 'center',
                  includeFontPadding: false,
                }}>{lotName}</Text>
              )}
            </View>
          </Marker>
        ))}
      </MapView>

      <LotDetailsSheet
        lot={sheetLot}
        visible={sheetLot !== null}
        onClose={() => setSheetLot(null)}
      />

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={24} color="#00853e" />
        </TouchableOpacity>
        <View style={styles.zoomDivider} />
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={24} color="#00853e" />
        </TouchableOpacity>
      </View>

      <View style={styles.capacityContainer}>
        <View style={styles.capacityRow}>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#2ECC71" }]} />
            <Text style={styles.capacityText}>AVAILABLE</Text>
          </View>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#F39C12" }]} />
            <Text style={styles.capacityText}>NEAR CAPACITY</Text>
          </View>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#E74C3C" }]} />
            <Text style={styles.capacityText}>FULL</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  lotLabel: {
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    padding: 3,
    marginBottom: 2,
    borderRadius: 14,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  statusBadgeDot: {
    padding: 1,
    marginBottom: 0,
  },
  statusIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomControls: {
    position: 'absolute',
    right: 16,
    bottom: 145,
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  zoomButton: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#eee',
    width: '70%',
    alignSelf: 'center',
  },
  capacityContainer: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    alignItems: "center",
    paddingBottom: 12,
  },
  capacityRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "90%",
    backgroundColor: "#fff",
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  capacityItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  capacityDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  capacityText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
});