import React, {useEffect, useRef} from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';

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
//Main-map component
interface EagleMapProps {
  liveLots: any[];
}

export default function EagleMap({ liveLots }: EagleMapProps) {
  // Center on UNT
  const untCenter = { lat: 33.2140, lng: -97.1475 };
  
  // Grab the API key from your .env file
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
          >
            {liveLots.map((lot) => {
              if (!lot.coordinates || lot.coordinates.length === 0) return null;
              
              // Grab the first coordinate of the lot to place the pin
              //const anchorCoord = lot.coordinates[0];
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
                  {lot.isVisible !== false && (() => {
                    const center = getLotCenter(lot.coordinates);
                    return center ? (
                      <Marker position={center}>
                        <div style={styles.hsgMarker}>{lot.tag}</div>
                      </Marker>
                    ) : null;
                  })()}
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
  hsgMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#BDBDBD',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    color: '#333333',
    fontSize: 11,
    fontWeight: '700',
    boxSizing: 'border-box',
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