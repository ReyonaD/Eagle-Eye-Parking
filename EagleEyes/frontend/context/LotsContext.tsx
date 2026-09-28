import React, { createContext, useState, useContext, ReactNode, useEffect} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '../utils/webCompat';
import { getLotPermitGroups, getLotCategory } from '../utils/permits';
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
}

// Exported so other screens (e.g. profile settings) can read/write it directly if needed.
export const FILTER_BY_PERMIT_STORAGE_KEY = 'filterLotsByPermit';

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

// ParkZen also reports a handful of on-street parking segments along named
// streets (not discrete numbered lots) — exclude those by name explicitly.
// A previous "must contain a two-digit lot number" heuristic tried to infer
// this instead, but it also silently dropped real lots like "Lot 1",
// "P9246 Lot", and "Murchison" that have no such number.
const ON_STREET_SEGMENT_NAMES = new Set([
  'sycamore st - n. texas blvd to ave d',
  'sycamore st - ave d to ave c',
  'sycamore st - motorcycle',
  'mulberry st (welch to bernard)',
  'mulberry st - ave d to ave b',
  'maple - welch to bernard',
  'highland st - n. tx blvd to ave d',
  'highland st - welch to bernard',
  'ave d - chestnut to mulberry',
  'chestnut - n. tx blvd to ave c',
  'kendolph - eagle to wilshire',
]);

function isCampusLot(lot: any): boolean {
  const sourceName = String(lot.lot_name || lot.name || '').trim().toLowerCase();

  if (/on[-\s]?street|street\s+parking/.test(sourceName)) return false;
  if (ON_STREET_SEGMENT_NAMES.has(sourceName)) return false;

  return true;
}

//defind the props for the Provider
//expect to receive standard React components inside the children variable
interface LotsProviderProps {
    children: ReactNode;
}

export function LotsProvider({ children }: { children : ReactNode }) {
    const [lots, setLots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
    const [filterByPermit, setFilterByPermitState] = useState(false);
    const hasLoadedOnce = React.useRef(false);

    useEffect(() => {
      AsyncStorage.getItem(FILTER_BY_PERMIT_STORAGE_KEY)
        .then((stored) => {
          if (stored != null) setFilterByPermitState(stored === 'true');
        })
        .catch((error) => console.error('Error loading permit filter preference:', error));
    }, []);

    const setFilterByPermit = (value: boolean) => {
      setFilterByPermitState(value);
      AsyncStorage.setItem(FILTER_BY_PERMIT_STORAGE_KEY, value ? 'true' : 'false').catch(
        (error) => console.error('Error saving permit filter preference:', error)
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
        setLots([]);
        return;
      }

      const formattedLots = data.filter(isCampusLot).map((lot: any, index: number) => {
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

        const fillColor = lot.fillColor || '#808080';
        const lotName = lot.lot_name || lot.name;
        const category = getLotCategory(lotName);
        const rawPermits = Array.isArray(lot.permits) ? lot.permits : [];

        return {
          ...lot,
          sourceId: String(lot.id || `lot-${index}`),
          id: `lot-${index}-${lot.id || 'no-id'}`,
          name: getLotDisplayName(lot, index),
          tag: getLotTag(lot, index),
          markerLabel: `${getPermitTag(lot)}, ${getLotTag(lot, index)}`,
          fillColor: lot.fillColor || 'rgba(53, 53, 53, 0.4)',
          strokeColor: lot.fillColor === '#2ECC71' ? '#27AE60' :
                       lot.fillColor === '#F39C12' ? '#D68910' :
                       lot.fillColor === '#E74C3C' ? '#C0392B' : '#6c6b6b',
          coordinates: mappedCoords,
          percentEmpty: emptyPercentage,
          status: uiStatus,
          lastUpdatedAt: lot.lastUpdatedAt || null,
          sourceTimestampProvidedByParkzen: lot.sourceTimestampProvidedByParkzen === true,
          captureTimeSource: lot.captureTimeSource || 'none',
          backendFetchedAt: lot.backendFetchedAt || null,
          // Raw ParkZen permits (e.g. A01, A02 ... A90) kept for reference
          rawPermitList: rawPermits,
          // Lot category from its name (A-Reserved / Resident Reserved / Street Parking).
          // Only the lots listed in "Lots to be changed" get one; every other lot is null.
          category,
          // Listed lots: consolidated permit groups with the category first (so its emblem shows).
          // All other lots: the original raw ParkZen permits, unchanged.
          permitList: category ? getLotPermitGroups(lotName, lot.permits) : rawPermits,
          permits: category
            ? getLotPermitGroups(lotName, lot.permits).join(',') || 'Unknown'
            : (lot.permits && Array.isArray(lot.permits) ? lot.permits.join(',') : 'Unknown')
        };
      }).filter((lot: any) => lot !== null);

      setLots(formattedLots);
      setLastRefreshAt(new Date().toISOString());
    } catch (error) {
      console.error("Error fetching lots:", error);
      setLots([]);
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

  useEffect(() => {
    if (!hasLoadedOnce.current && lots.length > 0) {
      hasLoadedOnce.current = true;
    }
  }, [lots]);
    return (
        <LotsContext.Provider value={{ lots, isLoading, lastRefreshAt, fetchLots, filterByPermit, setFilterByPermit }}>
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

