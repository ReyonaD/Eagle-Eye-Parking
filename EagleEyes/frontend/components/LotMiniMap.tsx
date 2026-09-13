import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import MapView, { Polygon, PROVIDER_GOOGLE } from 'react-native-maps';

interface LotMiniMapProps {
  coordinates: { latitude: number; longitude: number }[];
  region: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
  style?: StyleProp<ViewStyle>;
}

//non-interactive polygon preview for a single lot (used in the admin hazard detail view)
export default function LotMiniMap({ coordinates, region, style }: LotMiniMapProps) {
  return (
    <MapView
      style={style}
      provider={PROVIDER_GOOGLE}
      initialRegion={region}
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
    >
      <Polygon
        coordinates={coordinates}
        fillColor="rgba(0,133,62,0.45)"
        strokeColor="#00853E"
        strokeWidth={3}
      />
    </MapView>
  );
}
