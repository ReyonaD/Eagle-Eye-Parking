import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { nearestLotDistance, NEARBY_LOT_THRESHOLD_METERS, NEARBY_ZOOM_LEVEL_WEB } from '../utils/geo';
import { isLotClosed, getActiveEvent, LotStatus } from '../utils/lotStatus';
import { getCategoryLabel } from '../utils/alertVisuals';
import { useLots } from '../context/LotsContext';

// One line per closure/event/hazard on the lot, for the click popup.
function describeLotStatus(status?: LotStatus | null): string {
  if (!status) return '';
  const lines: string[] = [];
  if (status.closure) lines.push(`${status.closure.active ? 'CLOSED' : 'Closing later today'}: ${status.closure.alert.title}`);
  status.events.forEach((e) => lines.push(`${e.active ? 'Event now' : 'Event later today'}: ${e.alert.title}`));
  status.hazards.forEach((h) => lines.push(`Hazard (${getCategoryLabel('hazard', h.category)}): ${h.title}`));
  return lines.length ? `\n${lines.join('\n')}` : '';
}

const MAP_STYLES: any[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

// Same regions/zoom as the native map (components/EagleMap.tsx).
const CAMPUS_REGIONS: Record<string, { lat: number; lng: number }> = {
  'Main campus': { lat: 33.2110, lng: -97.1475 },
  'Discovery Park': { lat: 33.2549, lng: -97.1520 },
  'Frisco Landing': { lat: 33.1858, lng: -96.8055 },
};
const CAMPUS_ZOOM = 15;

// Pans/zooms the map when the CAMPUS dropdown changes — a plain prop change
// on <Map> only sets the *initial* view, so this has to go through the
// imperative google.maps instance instead.
function CampusPanController({ selectedCampus }: { selectedCampus: string }) {
  const map = useMap();

  useEffect(() => {
    const region = CAMPUS_REGIONS[selectedCampus];
    if (!map || !region) return;
    map.panTo(region);
    map.setZoom(CAMPUS_ZOOM);
  }, [map, selectedCampus]);

  return null;
}

// On app entry, if the browser reports the user is near a lot, zoom in on
// them instead of the default campus-wide view. Runs once (same
// navigator.geolocation pattern LotPickerModal.web.tsx already uses), reading
// the latest liveLots via a ref so it doesn't need to re-request location
// every time the 30s lot refresh hands in a new array.
function UserLocationAutoZoomController({ liveLots }: { liveLots: any[] }) {
  const map = useMap();
  const liveLotsRef = useRef(liveLots);
  liveLotsRef.current = liveLots;
  const startedRef = useRef(false);
  const { updateUserLocation } = useLots();

  useEffect(() => {
    if (startedRef.current || !map) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    startedRef.current = true;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLoc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        // Shared with the Lots tab so its permit picker can list nearby permits first.
        updateUserLocation(userLoc);
        const distance = nearestLotDistance(userLoc, liveLotsRef.current || []);
        if (distance > NEARBY_LOT_THRESHOLD_METERS) return; // far from campus — leave the default view.

        const applyZoom = () => {
          map.panTo({ lat: userLoc.latitude, lng: userLoc.longitude });
          map.setZoom(NEARBY_ZOOM_LEVEL_WEB);
        };

        // CampusPanController already pans/zooms this same map instance once
        // on mount — issuing our own pan/zoom in the same moment raced it and
        // threw deep inside the Maps SDK. Waiting for the map to report
        // "idle" (settled from that initial move) avoids the collision.
        const googleMaps = (window as any).google?.maps;
        if (googleMaps?.event) {
          googleMaps.event.addListenerOnce(map, 'idle', applyZoom);
        } else {
          applyZoom();
        }
      },
      () => {
        // Permission denied or unavailable — leave the default Main Campus view.
      },
      { timeout: 8000 },
    );
  }, [map]);

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

interface EagleMapProps {
  liveLots: any[];
  mapType?: 'standard' | 'satellite';
  selectedCampus?: string;
}

export default function EagleMap({ liveLots, mapType = 'standard', selectedCampus = 'Main campus' }: EagleMapProps) {
  const untCenter = { lat: 33.2140, lng: -97.1475 };
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
            styles={mapType === 'satellite' ? undefined : MAP_STYLES}
          >
            <CampusPanController selectedCampus={selectedCampus} />
            <UserLocationAutoZoomController liveLots={liveLots} />
            {liveLots.map((lot) => {
              if (!lot.coordinates || lot.coordinates.length === 0) return null;

              const webPaths = lot.coordinates.map((coord: any) => ({
                lat: coord.latitude,
                lng: coord.longitude,
              }));

              // Same hide-but-keep-in-the-list treatment as the native map:
              // a filtered-out lot goes transparent and unclickable instead
              // of disappearing, so re-selecting "All Permits" doesn't need
              // a re-fetch to bring it back.
              const hidden = lot.isVisible === false;

              return (
                <React.Fragment key={lot.id}>
                  <WebPolygon
                    paths={webPaths}
                    options={{
                      fillColor: hidden ? 'rgba(0,0,0,0)' : lot.fillColor,
                      strokeColor: hidden ? 'rgba(0,0,0,0)' : lot.strokeColor,
                      strokeWeight: hidden ? 0 : (getActiveEvent(lot.lotStatus) || isLotClosed(lot.lotStatus) ? 4 : 2),
                      clickable: !hidden,
                    }}
                    onClick={() => {
                      window.alert(
                        `${lot.name}\n` +
                        `Permits: ${lot.permits}\n` +
                        `Percent Empty: ${lot.percentEmpty !== undefined ? lot.percentEmpty + '%' : 'Unknown'}\n` +
                        `Is Full: ${lot.isFull ? 'Yes' : 'No'}` +
                        describeLotStatus(lot.lotStatus)
                      );
                    }}
                  />
                </React.Fragment>
              );
            })}
          </Map>
        </APIProvider>
      ) : (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Google Maps API Key is missing!</Text>
        </View>
      )}

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