import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { nearestLotDistance, nearestCampus, NEARBY_LOT_THRESHOLD_METERS, NEARBY_ZOOM_LEVEL_WEB, getStripeSegments } from '../utils/geo';
import { isLotClosed, getActiveEvent, CLOSED_STRIPE_WIDTH } from '../utils/lotStatus';
import { LIGHT_MAP_STYLE, DARK_MAP_STYLE, getClosedLotColors, getLotStrokeColor, getLotFillOpacity } from '../utils/mapStyles';
import { useLots } from '../context/LotsContext';
import LotDetailsSheet from './LotDetailsSheet';

// Same regions/zoom as the native map (components/EagleMap.tsx).
const CAMPUS_REGIONS: Record<string, { lat: number; lng: number }> = {
  'Main campus': { lat: 33.2110, lng: -97.1475 },
  'Discovery Park': { lat: 33.2549, lng: -97.1520 },
  'Frisco Landing': { lat: 33.1858, lng: -96.8055 },
};
const CAMPUS_ZOOM = 15;

// Pans the map when the CAMPUS dropdown changes (<Map> props only set the initial view).
// shownCampusRef is the campus the map is showing; the dropdown being set to it
// (e.g. after zooming to the user) doesn't move the map.
function CampusPanController({ selectedCampus, shownCampusRef }: { selectedCampus: string; shownCampusRef: React.MutableRefObject<string> }) {
  const map = useMap();

  useEffect(() => {
    const region = CAMPUS_REGIONS[selectedCampus];
    if (!map || !region || selectedCampus === shownCampusRef.current) return;
    shownCampusRef.current = selectedCampus;
    map.panTo(region);
    map.setZoom(CAMPUS_ZOOM);
  }, [map, selectedCampus, shownCampusRef]);

  return null;
}

// On load, zoom to the user if they're near a lot (runs once). Waits for the lots:
// with permission already granted the fix can arrive before they load, and judging
// "near a lot" against an empty list would wrongly keep the Main Campus view.
function UserLocationAutoZoomController({ liveLots, shownCampusRef, onCampusDetected }: {
  liveLots: any[];
  shownCampusRef: React.MutableRefObject<string>;
  onCampusDetected?: (campus: string) => void;
}) {
  const map = useMap();
  const startedRef = useRef(false);
  const doneRef = useRef(false);
  const [userLoc, setUserLoc] = useState<{ latitude: number; longitude: number } | null>(null);
  const { updateUserLocation } = useLots();

  useEffect(() => {
    if (startedRef.current || !map) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    startedRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        // Shared with the Lots tab so its permit picker can list nearby permits first.
        updateUserLocation(loc);
        setUserLoc(loc);
      },
      () => {
        // Permission denied or unavailable — leave the default Main Campus view.
      },
      { timeout: 8000 },
    );
  }, [map]);

  useEffect(() => {
    if (doneRef.current || !map || !userLoc || !liveLots || liveLots.length === 0) return;
    doneRef.current = true;
    if (nearestLotDistance(userLoc, liveLots) > NEARBY_LOT_THRESHOLD_METERS) return; // far from campus — leave the default view.
    const campus = nearestCampus(userLoc);
    shownCampusRef.current = campus;
    onCampusDetected?.(campus);

    const applyZoom = () => {
      map.panTo({ lat: userLoc.latitude, lng: userLoc.longitude });
      map.setZoom(NEARBY_ZOOM_LEVEL_WEB);
    };

    // Wait for "idle" so this doesn't race CampusPanController's initial move.
    const googleMaps = (window as any).google?.maps;
    if (googleMaps?.event) {
      googleMaps.event.addListenerOnce(map, 'idle', applyZoom);
    } else {
      applyZoom();
    }
  }, [map, userLoc, liveLots, shownCampusRef, onCampusDetected]);

  return null;
}

function WebPolygon({ paths, options, onClick }: { paths: any; options: any; onClick?: () => void }) {
  const map = useMap();
  const polygonRef = React.useRef<any>(null);

  useEffect(() => {
    if (!map || !(window as any).google) return;
    if (!polygonRef.current) {
      polygonRef.current = new (window as any).google.maps.Polygon();
    }

    polygonRef.current.setMap(map);
    const listener = polygonRef.current.addListener('click', onClick);

    return () => {
      listener.remove();
      polygonRef.current?.setMap(null);
    };
  }, [map, onClick]);

  useEffect(() => {
    if (!polygonRef.current) return;
    polygonRef.current.setOptions({
      ...options,
      paths,
    });
  }, [paths, options]);

  return null;
}

// Stripes over a closed lot, as one unclickable polygon so clicks reach the lot.
function WebStripes({ coordinates, color }: { coordinates: { latitude: number; longitude: number }[]; color: string }) {
  const map = useMap();
  const stripesRef = React.useRef<any>(null);
  const paths = React.useMemo(
    () => getStripeSegments(coordinates).map((segment) =>
      segment.map((point) => ({ lat: point.latitude, lng: point.longitude }))),
    [coordinates],
  );

  useEffect(() => {
    if (!map || !(window as any).google) return;
    stripesRef.current = new (window as any).google.maps.Polygon({
      map,
      paths,
      strokeColor: color,
      strokeWeight: CLOSED_STRIPE_WIDTH,
      fillOpacity: 0,
      clickable: false,
    });
    return () => {
      stripesRef.current?.setMap(null);
      stripesRef.current = null;
    };
  }, [map, paths, color]);

  return null;
}

// Re-center button: asks the browser for a fresh position, flies there at lot zoom,
// and sets the campus dropdown to match.
function RecenterButton({ shownCampusRef, onCampusDetected }: {
  shownCampusRef: React.MutableRefObject<string>;
  onCampusDetected?: (campus: string) => void;
}) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  const recenter = () => {
    if (!map || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const campus = nearestCampus(loc);
        shownCampusRef.current = campus;
        onCampusDetected?.(campus);
        map.panTo({ lat: loc.latitude, lng: loc.longitude });
        map.setZoom(NEARBY_ZOOM_LEVEL_WEB);
      },
      () => {
        setLocating(false);
        window.alert('Your location is unavailable. Allow location access for this site and try again.');
      },
      { timeout: 8000, maximumAge: 30000 },
    );
  };

  return (
    <TouchableOpacity
      style={styles.recenterButton}
      onPress={recenter}
      accessibilityRole="button"
      accessibilityLabel="Center on my location"
    >
      <Ionicons name={locating ? 'navigate-outline' : 'navigate'} size={22} color="#00853e" />
    </TouchableOpacity>
  );
}

interface EagleMapProps {
  liveLots: any[];
  mapType?: 'standard' | 'satellite';
  selectedCampus?: string;
  // Called with the campus the user is on when the map zooms to their location.
  onCampusDetected?: (campus: string) => void;
  darkMap?: boolean;
}

export default function EagleMap({ liveLots, mapType = 'standard', selectedCampus = 'Main campus', onCampusDetected, darkMap = false }: EagleMapProps) {
  // Satellite imagery is dark too, so it gets the same lighter overlay shades.
  const darkSurface = darkMap || mapType === 'satellite';
  const closedColors = getClosedLotColors(darkSurface);
  const untCenter = { lat: 33.2140, lng: -97.1475 };
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  //lot whose details sheet is open (same sheet as the native map)
  const [sheetLot, setSheetLot] = useState<any | null>(null);
  // the map opens on Main campus (defaultCenter)
  const shownCampusRef = useRef('Main campus');

  return (
    <View style={styles.container}>
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={untCenter}
            defaultZoom={15}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            mapTypeId={mapType === 'satellite' ? 'satellite' : 'roadmap'}
            styles={mapType === 'satellite' ? undefined : (darkMap ? DARK_MAP_STYLE : LIGHT_MAP_STYLE)}
          >
            <CampusPanController selectedCampus={selectedCampus} shownCampusRef={shownCampusRef} />
            <UserLocationAutoZoomController liveLots={liveLots} shownCampusRef={shownCampusRef} onCampusDetected={onCampusDetected} />
            {liveLots.map((lot) => {
              if (!lot.coordinates || lot.coordinates.length === 0) return null;

              const webPaths = lot.coordinates.map((coord: any) => ({
                lat: coord.latitude,
                lng: coord.longitude,
              }));

              // Filtered-out lots go transparent instead of being removed.
              const hidden = lot.isVisible === false;

              return (
                <React.Fragment key={lot.id}>
                  <WebPolygon
                    paths={webPaths}
                    options={{
                      fillColor: hidden ? 'rgba(0,0,0,0)' : (isLotClosed(lot.lotStatus) ? closedColors.fill : lot.fillColor),
                      fillOpacity: getLotFillOpacity(darkMap),
                      strokeColor: hidden ? 'rgba(0,0,0,0)' : (isLotClosed(lot.lotStatus) ? closedColors.stroke : getLotStrokeColor(lot.strokeColor, darkSurface)),
                      strokeWeight: hidden ? 0 : (getActiveEvent(lot.lotStatus) && !isLotClosed(lot.lotStatus) ? 4 : 2),
                      clickable: !hidden,
                    }}
                    onClick={() => setSheetLot(lot)}
                  />
                  {!hidden && isLotClosed(lot.lotStatus) && <WebStripes coordinates={lot.coordinates} color={closedColors.stripe} />}
                </React.Fragment>
              );
            })}
          </Map>
          <RecenterButton shownCampusRef={shownCampusRef} onCampusDetected={onCampusDetected} />
        </APIProvider>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Google Maps API Key is missing!</Text>
        </View>
      )}

      <LotDetailsSheet lot={sheetLot} visible={sheetLot !== null} onClose={() => setSheetLot(null)} />

      <View style={styles.capacityContainer}>
        <View style={styles.capacityRow}>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#27AE60" }]} />
            <Text style={styles.capacityText}>AVAILABLE</Text>
          </View>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#D68910" }]} />
            <Text style={styles.capacityText}>NEAR CAPACITY</Text>
          </View>
          <View style={styles.capacityItem}>
            <View style={[styles.capacityDot, { backgroundColor: "#C0392B" }]} />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eaeaea',
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  // same spot and look as the native map's zoom controls
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 145,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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