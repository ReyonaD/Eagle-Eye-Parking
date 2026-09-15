import React, { useEffect, useRef } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';

function StaticPolygon({ paths }: { paths: { lat: number; lng: number }[] }) {
  const map = useMap();
  const polygonRef = useRef<any>(null);

  useEffect(() => {
    if (!map || !(window as any).google) return;
    if (!polygonRef.current) {
      polygonRef.current = new (window as any).google.maps.Polygon({
        fillColor: '#00853E',
        fillOpacity: 0.45,
        strokeColor: '#00853E',
        strokeWeight: 3,
      });
    }
    polygonRef.current.setPaths(paths);
    polygonRef.current.setMap(map);
    return () => polygonRef.current?.setMap(null);
  }, [map, paths]);

  return null;
}

interface LotMiniMapProps {
  coordinates: { latitude: number; longitude: number }[];
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  style?: StyleProp<ViewStyle>;
}

//non-interactive polygon preview for a single lot (used in the admin hazard detail view)
export default function LotMiniMap({ coordinates, region, style }: LotMiniMapProps) {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const paths = coordinates.map(c => ({ lat: c.latitude, lng: c.longitude }));

  if (!apiKey) return null;

  return (
    <View style={style}>
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={{ lat: region.latitude, lng: region.longitude }}
          defaultZoom={17}
          gestureHandling="none"
          disableDefaultUI
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
        >
          <StaticPolygon paths={paths} />
        </Map>
      </APIProvider>
    </View>
  );
}
