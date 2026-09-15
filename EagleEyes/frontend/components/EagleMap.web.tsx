import React, {useEffect, useRef} from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { AdvancedMarker, APIProvider, Map, useMap } from '@vis.gl/react-google-maps';

// Hide POI/transit clutter so the lot polygons are the visual focus; roads
// and labels stay for orientation.
const MAP_STYLES: any[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];
const LOT_29_RESIDENT_RESERVE_PIN_SOUTH_OFFSET = 0.00015;
const LOT_29_RESIDENT_RESERVE_PIN_EAST_OFFSET = 0.00015;

function WebPolygon({paths, options, onClick}: {paths: any, options: any, onClick?: () => void}) {
    const map = useMap();
    const polygonRef = React.useRef<any>(null);

    useEffect(() => {
        if (!map || !(window as any).google) return;
        if (!polygonRef.current){
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

function getLotCenter(coordinates: { latitude: number; longitude: number }[]) {
  if (coordinates.length === 0) return null;

  const totals = coordinates.reduce(
    (center, coordinate) => ({
      latitude: center.latitude + coordinate.latitude,
      longitude: center.longitude + coordinate.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  return {
    lat: totals.latitude / coordinates.length,
    lng: totals.longitude / coordinates.length,
  };
}

function getLotMarkerCenter(lot: any) {
  const center = getLotCenter(lot.coordinates || []);
  if (!center) return null;

  const lotName = String(lot.name || lot.lot_name || '');
  const normalizedLotName = lotName.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (/\blot\s*20\b.*\beagle\b/i.test(lotName)) {
    // Adjust these numbers to change the position of the Lot 20 Eagle pin.
    const LOT_20_PIN_SOUTH_OFFSET = 0.00015;
    const LOT_20_PIN_EAST_OFFSET = 0.00015;
    return {
      ...center,
      lat: center.lat - LOT_20_PIN_SOUTH_OFFSET,
      lng: center.lng + LOT_20_PIN_EAST_OFFSET,
    };
  }

  if (/\blot\s*24\b.*\ba[-\s]?reserved\b/i.test(lotName)) {
    // Adjust this number to change the northward position of the Lot 24 A-Reserved pin.
    const LOT_24_A_RESERVED_PIN_NORTH_OFFSET = 0.00015;
    return {
      ...center,
      lat: center.lat + LOT_24_A_RESERVED_PIN_NORTH_OFFSET,
    };
  }

  if (/\blot\s*29\b.*\bresident\s+reserve(?:d)?\b/i.test(normalizedLotName)) {
    // Adjust these numbers to change the south/east position of the Lot 29 Resident Reserve pin.
    return {
      ...center,
      lat: center.lat - LOT_29_RESIDENT_RESERVE_PIN_SOUTH_OFFSET,
      lng: center.lng + LOT_29_RESIDENT_RESERVE_PIN_EAST_OFFSET,
    };
  }

  return center;
}

function getGroupedMarkerCenter(lots: any[]) {
  const centers = lots
    .map(getLotMarkerCenter)
    .filter((center): center is { lat: number; lng: number } => center !== null);
  if (centers.length === 0) return null;

  const totals = centers.reduce(
    (center, lotCenter) => ({
      lat: center.lat + lotCenter.lat,
      lng: center.lng + lotCenter.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / centers.length,
    lng: totals.lng / centers.length,
  };
}

function getLotMarkerSize(coordinates: { latitude: number; longitude: number }[], tag: string) {
  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
  const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
  const mapScale = 18000;
  const fontSize = Math.max(8, Math.min(10, Math.min(
    longitudeSpan * mapScale * 0.7,
    latitudeSpan * mapScale * 0.7,
  ) * 0.4));
  const labelWidth = tag.length * fontSize * 0.7 + 8;
  const width = Math.max(13, Math.min(24, Math.max(longitudeSpan * mapScale * 0.55, labelWidth)));

  return {
    width,
    height: Math.max(20, Math.min(30, latitudeSpan * mapScale * 0.55)),
    circleSize: width,
    fontSize,
  };
}

function shouldShowLotMarker(lot: any): boolean {
  const name = String(lot.lot_name || lot.name || '').trim();
  return /\blot\s+(?:[1-9]|[1-9]\d)\b/i.test(name)
    || /^(?:highland street garage|union circle garage)$/i.test(name);
}

function isLot29(lot: any): boolean {
  return /\blot\s*29\b/i.test(String(lot.name || lot.lot_name || ''));
}

function getLotMarkerGroups(lots: any[], zoom: number) {
  const latitudeDelta = 0.018 / 2 ** (zoom - 15);
  const groupingDistance = Math.max(0.00008, latitudeDelta * 0.08);
  const groups: { lots: any[]; center: { lat: number; lng: number } }[] = [];

  lots.forEach((lot) => {
    if (lot.isVisible === false || !shouldShowLotMarker(lot)) return;
    const center = getLotMarkerCenter(lot);
    if (!center) return;

    const isCloseToLot29 = zoom >= 17 && isLot29(lot);
    const existingGroup = groups.find((group) => {
      if (isCloseToLot29 || group.lots.some(isLot29)) return false;
      const latitudeDistance = group.center.lat - center.lat;
      const longitudeDistance = (group.center.lng - center.lng) * Math.cos(center.lat * Math.PI / 180);
      return Math.hypot(latitudeDistance, longitudeDistance) <= groupingDistance;
    });

    if (existingGroup) {
      existingGroup.lots.push(lot);
      const groupedCenter = getGroupedMarkerCenter(existingGroup.lots);
      if (groupedCenter) existingGroup.center = groupedCenter;
    } else {
      groups.push({ lots: [lot], center });
    }
  });

  return groups;
}

function WebZoomWatcher({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    const updateZoom = () => onZoomChange(map.getZoom() || 15);
    updateZoom();
    const listener = map.addListener('zoom_changed', updateZoom);
    return () => listener.remove();
  }, [map, onZoomChange]);

  return null;
}

function WebClusterMarker({
  center,
  count,
}: {
  center: { lat: number; lng: number };
  count: number;
}) {
  const map = useMap();

  return (
    <AdvancedMarker
      position={center}
      onClick={() => {
        if (!map) return;
        map.panTo(center);
        map.setZoom(Math.min((map.getZoom() || 15) + 2, 21));
      }}
    >
      <div style={styles.clusterMarker}>
        <span style={styles.clusterMarkerText}>{count}</span>
      </div>
    </AdvancedMarker>
  );
}
//Main-map component
interface EagleMapProps {
  liveLots: any[];
}

export default function EagleMap({ liveLots }: EagleMapProps) {
  // Center on UNT
  const untCenter = { lat: 33.2140, lng: -97.1475 };
  
  // Grab the API key from your .env file
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const [zoom, setZoom] = React.useState(15);

  return (
    <View style={styles.container}>
      
      {/* WEB MAP */}
      {apiKey ? (
        <APIProvider apiKey={apiKey}>
          <Map
            defaultCenter={untCenter}
            defaultZoom={15}
            gestureHandling={'greedy'}
            disableDefaultUI={true}
            styles={MAP_STYLES}
          >
            <WebZoomWatcher onZoomChange={setZoom} />
            {liveLots.map((lot) => {
              if (!lot.coordinates || lot.coordinates.length === 0) return null;

              const webPaths = lot.coordinates.map((coord: any) => ({
                lat: coord.latitude,
                lng: coord.longitude
              }));
              
              return (
                <React.Fragment key={lot.id}>
                  <WebPolygon 
                    paths={webPaths} 
                    options={{
                      fillColor: lot.fillColor,
                      strokeColor: lot.strokeColor,
                      strokeWeight: 2,
                      clickable: true,
                    }}
                    onClick={() => {
                      window.alert(
                        `${lot.name}\n` +
                        `Permits: ${lot.permits}\n` +
                        `Percent Empty: ${lot.percentEmpty !== undefined ? lot.percentEmpty + '%' : 'Unknown'}\n` +
                        `Is Full: ${lot.isFull ? 'Yes' : 'No'}`
                      );
                    }}
                  />
                  {getLotMarkerGroups(liveLots, zoom)
                    .filter((group) => group.lots[0].id === lot.id)
                    .map((group) => {
                      const markerLot = group.lots[0];
                      if (group.lots.length > 1) {
                        return (
                          <WebClusterMarker
                            key={`${group.lots.map((groupLot) => groupLot.id).join('-')}-cluster`}
                            center={group.center}
                            count={group.lots.length}
                          />
                        );
                      }

                      const markerSize = getLotMarkerSize(markerLot.coordinates, markerLot.tag);
                      return (
                      <AdvancedMarker
                        key={`${group.lots.map((groupLot) => groupLot.id).join('-')}-label`}
                        position={group.center}
                        onClick={() => {
                          window.alert(
                            `${markerLot.name}\n` +
                            `Permits: ${markerLot.permits}\n` +
                            `Percent Empty: ${markerLot.percentEmpty !== undefined ? markerLot.percentEmpty + '%' : 'Unknown'}\n` +
                            `Is Full: ${markerLot.isFull ? 'Yes' : 'No'}`
                          );
                        }}
                      >
                        <div
                          style={{
                            ...styles.markerContainer,
                            width: markerSize.width,
                            height: markerSize.height + markerSize.circleSize / 2,
                          }}
                        >
                          <div
                            style={{
                              ...styles.markerCircle,
                              width: markerSize.circleSize,
                              height: markerSize.circleSize,
                              borderRadius: markerSize.circleSize / 2,
                            }}
                          />
                          <div style={{ ...styles.hsgMarker, ...markerSize }}>{markerLot.tag}</div>
                        </div>
                      </AdvancedMarker>
                      );
                    })}
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

      {/* CAPACITY INDICATOR AT BOTTOM*/}
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
    backgroundColor: '#eaeaea'
  },
  errorText: {
    fontSize: 16,
    color: '#d32f2f',
    fontWeight: 'bold'
  },
  markerContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  markerCircle: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#FFFFFF',
    flexShrink: 0,
    zIndex: 2,
  },
  clusterMarker: {
    width: 26,
    height: 26,
    borderRadius: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3366ff',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    boxSizing: 'border-box',
  },
  clusterMarkerText: {
    position: 'relative',
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    zIndex: 1,
  },
  hsgMarker: {
    width: 26,
    height: 36,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    color: '#333333',
    fontWeight: '700',
    paddingTop: 2,
    paddingLeft: 1,
    paddingRight: 1,
    overflow: 'hidden',
    boxSizing: 'border-box',
    zIndex: 1,
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