import React, { createContext, useState, useContext, ReactNode, useEffect, useMemo} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/webCompat';
import { getLotPermitGroups, getLotCategory } from '../utils/permits';
import { getEffectivePermits, isNightWindow } from '../utils/nightPermitRules';
import { distanceMeters, LatLng } from '../utils/geo';
//define the exact shape of data
interface LotsContextType {
    lots: any[];
    isLoading: boolean;
    lastRefreshAt: string | null;
    fetchLots: () => Promise<void>;
    // Whether the Map and Lots tabs should be limited to lots matching the
    // signed-in user's own permit type. Lives here (not on the account profile)
    // so it persists across logins/logouts on this device without needing
    // refreshUser's account-rebuild to know about it.
    filterByPermit: boolean;
    setFilterByPermit: (value: boolean) => void;
    // Lets a commuter preview the other time-of-day's permit rules ahead of
    // time. null = follow the real clock (default).
    previewMode: 'day' | 'night' | null;
    setPreviewMode: (value: 'day' | 'night' | null) => void;
    // The real current day/night state, regardless of previewMode.
    actuallyNight: boolean;
    // Commuter's preferred map rendering, set from Profile Setting.
    mapType: 'standard' | 'satellite';
    setMapType: (value: 'standard' | 'satellite') => void;
    // Last known device location, reported by the Map tab's own location fix
    // (so the Lots tab can rank nearby permits without a second permission
    // prompt). null until a fix arrives or if permission was denied.
    userLocation: LatLng | null;
    updateUserLocation: (value: LatLng) => void;
}

// Ignore location updates smaller than this so GPS jitter doesn't re-render
// every screen that reads the context.
const USER_LOCATION_MIN_MOVE_METERS = 25;

// Exported so other screens (e.g. profile settings) can read/write it directly if needed.
export const FILTER_BY_PERMIT_STORAGE_KEY = 'filterLotsByPermit';
export const MAP_TYPE_STORAGE_KEY = 'mapType';

//create the context
const LotsContext = createContext<LotsContextType | undefined>(undefined);

const LOT_TAGS: Record<string, string> = {
  hsg: 'HSG',
};

const PERMIT_ABBREVIATIONS: Record<string, string> = {
  'Premium Parking': 'PP',
  'Motorcycle': 'MC',
  'Faculty/Staff': 'F/S',
  'Visitor': 'VIS',
  'General': 'GEN',
  'Economy': 'E',
  'Student': 'STU',
  'Service Vehicle': 'SV',
};

function getPermitTag(lot: any): string {
  const permits = Array.isArray(lot.permits)
    ? lot.permits
    : typeof lot.permits === 'string'
      ? lot.permits.split(',').map((permit: string) => permit.trim()).filter(Boolean)
      : Array.isArray(lot.permitList)
        ? lot.permitList
        : [];
  if (permits.length === 0) return '?';

  const rawPermit = String(permits[0]).trim();
  const strippedPermit = rawPermit.replace(/\s*\(.*$/, '').trim();
  return PERMIT_ABBREVIATIONS[rawPermit]
    || PERMIT_ABBREVIATIONS[strippedPermit]
    || (strippedPermit.length <= 4 ? strippedPermit : strippedPermit.slice(0, 3).toUpperCase());
}

function getLotTag(lot: any, index: number): string {
  const sourceId = String(lot.id || '').trim();
  if (sourceId && LOT_TAGS[sourceId]) return LOT_TAGS[sourceId];

  const sourceName = String(lot.lot_name || lot.name || '').trim();
  const normalizedName = sourceName.toLowerCase();
  if (normalizedName === 'hsg') return 'HSG';
  if (normalizedName.includes('union circle') && normalizedName.includes('garage')) return 'UCG';

  const nameTag = sourceName.match(/\b(?:lot|garage)\s*([a-z0-9-]+)/i)?.[1];
  if (nameTag) return nameTag.toUpperCase();

  if (sourceId) return sourceId.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `LOT-${index + 1}`;
}

function getLotDisplayName(lot: any, index: number): string {
  const rawName = lot.lot_name || lot.name || '';
  const rawId = String(lot.id || '').toLowerCase();
  const normalizedName = String(rawName).toLowerCase();

  if (normalizedName === 'hsg' || rawId === 'hsg') {
    return 'HSG';
  }

  return rawName || `Lot ${index}`;
}

//defind the props for the Provider
//expect to receive standard React components inside the children variable
interface LotsProviderProps {
    children: ReactNode;
}

export function LotsProvider({ children }: { children : ReactNode }) {
    const [rawLots, setRawLots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
    const [filterByPermit, setFilterByPermitState] = useState(false);
    const [previewMode, setPreviewModeState] = useState<'day' | 'night' | null>(null);
    const [mapType, setMapTypeState] = useState<'standard' | 'satellite'>('standard');
    const [userLocation, setUserLocation] = useState<LatLng | null>(null);
    const hasLoadedOnce = React.useRef(false);

    useEffect(() => {
      AsyncStorage.getItem(FILTER_BY_PERMIT_STORAGE_KEY)
        .then((stored) => {
          if (stored != null) setFilterByPermitState(stored === 'true');
        })
        .catch((error) => console.error('Error loading permit filter preference:', error));

      AsyncStorage.getItem(MAP_TYPE_STORAGE_KEY)
        .then((stored) => {
          if (stored === 'standard' || stored === 'satellite') setMapTypeState(stored);
        })
        .catch((error) => console.error('Error loading map type preference:', error));
    }, []);

    const setFilterByPermit = (value: boolean) => {
      setFilterByPermitState(value);
      AsyncStorage.setItem(FILTER_BY_PERMIT_STORAGE_KEY, value ? 'true' : 'false').catch(
        (error) => console.error('Error saving permit filter preference:', error)
      );
    };

    const setMapType = (value: 'standard' | 'satellite') => {
      setMapTypeState(value);
      AsyncStorage.setItem(MAP_TYPE_STORAGE_KEY, value).catch(
        (error) => console.error('Error saving map type preference:', error)
      );
    };

    const fetchLots = async (showLoading = false) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;
      
      const response = await apiFetch(`${BACKEND_URL}/api/lots`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);

      const data = await response.json();
      //console.log("RAW LOT DATA:", JSON.stringify(data[0].occupancy, null, 2));
      //console.log("DEBUG - FIRST LOT DATA:", JSON.stringify(data[0], null, 2));
      if (!Array.isArray(data)) {
        setRawLots([]);
        return;
      }

      const formattedLots = data.map((lot: any, index: number) => {
        const mappedCoords = (lot.vertices || []).map((v: any) => ({
          latitude: parseFloat(v.latitude) || parseFloat(v.lat),
          longitude: parseFloat(v.longitude) || parseFloat(v.lng) || parseFloat(v.lon)
        })).filter((v: any) => !isNaN(v.latitude) && !isNaN(v.longitude));

        if (mappedCoords.length < 3) return null;

        // Read the backend occupancy estimate from either the source-specific field
        // or the direct ParkZen estimate, and tolerate older payloads without
        // lastUpdatedVia set.
        let emptyPercentage = null;
        const occupancy = lot.occupancy || {};
        const method = occupancy.lastUpdatedVia || 'python-fusion';
        const estimate =
          typeof occupancy[method]?.estimate === 'number'
            ? occupancy[method].estimate
            : typeof occupancy.parkzenServerOccupancyEstimate === 'number'
              ? occupancy.parkzenServerOccupancyEstimate
              : typeof occupancy.lprEstimate === 'number'
                ? occupancy.lprEstimate
                : null;

        if (typeof estimate === 'number') {
          emptyPercentage = Math.round((1 - estimate) * 100);
        }

        // Translate Backend Status to UI Status
        let uiStatus = 'Available';
        if (lot.infoSheetTitle === 'Full') {
          uiStatus = 'Full';
        } else if (lot.infoSheetTitle === 'Medium') {
          uiStatus = 'Near Capacity';
        } else if (lot.infoSheetTitle === 'No Data' || !estimate) {
          uiStatus = 'No Data';
        }

        const lotName = lot.lot_name || lot.name;
        const category = getLotCategory(lotName);
        const rawPermits = Array.isArray(lot.permits) ? lot.permits : [];
        // Listed lots: consolidated permit groups, category first (for the emblem).
        // All other lots: raw ParkZen permits, unchanged. Daytime list — the
        // Day/Night preview (below, in the derived `lots` memo) decides whether
        // this or the chart's night-time list is actually shown.
        const dayPermitList = category ? getLotPermitGroups(lotName, lot.permits) : rawPermits;

        return {
          ...lot,
          sourceId: String(lot.id || `lot-${index}`),
          id: `lot-${index}-${lot.id || 'no-id'}`,
          name: getLotDisplayName(lot, index),
          tag: getLotTag(lot, index),
          markerLabel: `${getPermitTag(lot)}, ${getLotTag(lot, index)}`,
          coordinates: mappedCoords,
          // "day" prefix = live ParkZen data for right now. The derived `lots`
          // memo below either passes these through as-is or, when previewing
          // the *other* time-of-day, replaces them with neutral placeholders
          // (occupancy can't be known for a time that hasn't happened yet).
          dayFillColor: lot.fillColor || 'rgba(53, 53, 53, 0.4)',
          dayStrokeColor: lot.fillColor === '#2ECC71' ? '#27AE60' :
                       lot.fillColor === '#F39C12' ? '#D68910' :
                       lot.fillColor === '#E74C3C' ? '#C0392B' : '#6c6b6b',
          dayPercentEmpty: emptyPercentage,
          dayStatus: uiStatus,
          dayLastUpdatedAt: lot.lastUpdatedAt || null,
          daySourceTimestampProvidedByParkzen: lot.sourceTimestampProvidedByParkzen === true,
          captureTimeSource: lot.captureTimeSource || 'none',
          backendFetchedAt: lot.backendFetchedAt || null,
          // Raw ParkZen permits (e.g. A01, A02 ... A90) kept for reference
          rawPermitList: rawPermits,
          // Lot category from its name (A-Reserved / Resident Reserved / Street Parking).
          // Only the lots listed in "Lots to be changed" get one; every other lot is null.
          category,
          dayPermitList,
        };
      }).filter((lot: any) => lot !== null);

      setRawLots(formattedLots);
      setLastRefreshAt(new Date().toISOString());
    } catch (error) {
      console.error("Error fetching lots:", error);
      setRawLots([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh the lot data periodically so the map stays synchronized with ParkZen.
  useEffect(() => {
    fetchLots(true);

    const intervalId = setInterval(() => {
      fetchLots(false);
    }, 30000);

    return () => clearInterval(intervalId);
  }, []);

  // Picking the time of day it actually is goes back to following the clock
  // (null), so switching to Night and back to Day doesn't leave the app pinned
  // to "Day" — which would silently turn into a stale preview at 5:30pm.
  const setPreviewMode = (value: 'day' | 'night' | null) => {
    setPreviewModeState(value !== null && (value === 'night') === isNightWindow() ? null : value);
  };

  const updateUserLocation = (value: LatLng) => {
    setUserLocation((prev) =>
      prev && distanceMeters(prev, value) < USER_LOCATION_MIN_MOVE_METERS ? prev : value
    );
  };

  const actuallyNight = isNightWindow();
  // null previewMode = follow the real clock.
  const previewingNight = previewMode === null ? actuallyNight : previewMode === 'night';
  // Occupancy only means something for the time it was measured at — once the
  // preview diverges from the real clock, gray it out instead of showing
  // right-now data next to rules for a time that hasn't happened yet.
  const showLiveOccupancy = previewingNight === actuallyNight;

  const lots = useMemo(() => rawLots.map((lot) => {
    const permitList = getEffectivePermits(lot.category, lot.dayPermitList, previewingNight);
    return {
      ...lot,
      permitList,
      permits: permitList.join(',') || 'Unknown',
      fillColor: showLiveOccupancy ? lot.dayFillColor : '#808080',
      strokeColor: showLiveOccupancy ? lot.dayStrokeColor : '#6c6b6b',
      percentEmpty: showLiveOccupancy ? lot.dayPercentEmpty : null,
      status: showLiveOccupancy ? lot.dayStatus : 'No Data',
      lastUpdatedAt: showLiveOccupancy ? lot.dayLastUpdatedAt : null,
      sourceTimestampProvidedByParkzen: showLiveOccupancy ? lot.daySourceTimestampProvidedByParkzen : false,
    };
  }), [rawLots, previewingNight, showLiveOccupancy]);

  useEffect(() => {
    if (!hasLoadedOnce.current && lots.length > 0) {
      hasLoadedOnce.current = true;
    }
  }, [lots]);
    return (
        <LotsContext.Provider value={{
          lots, isLoading, lastRefreshAt, fetchLots, filterByPermit, setFilterByPermit,
          previewMode, setPreviewMode, actuallyNight, mapType, setMapType,
          userLocation, updateUserLocation,
        }}>
            {children}
        </LotsContext.Provider>
    );
}

//safety check to ensure the context is used within its provider
export const useLots = () => {
    const context = useContext(LotsContext);
    if (context === undefined){
        throw new Error('userLots must be used within a LotsProvider');
    }
    return context;
};

