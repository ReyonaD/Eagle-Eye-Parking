import React, { createContext, useState, useContext, ReactNode, useEffect} from 'react';
import { apiFetch } from '../utils/webCompat';
//define the exact shape of data
interface LotsContextType {
    lots: any[];
    isLoading: boolean;
    lastRefreshAt: string | null;
    fetchLots: () => Promise<void>;
}

//create the context 
const LotsContext = createContext<LotsContextType | undefined>(undefined);

//defind the props for the Provider
//expect to receive standard React components inside the children variable
interface LotsProviderProps {
    children: ReactNode;
}

export function LotsProvider({ children }: { children : ReactNode }) {
    const [lots, setLots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
    const hasLoadedOnce = React.useRef(false);

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

        const fillColor = lot.fillColor || '#808080';

        return {
          ...lot,
          id: `lot-${index}-${lot.id || 'no-id'}`,
          name: lot.lot_name || lot.name || `Lot ${index}`,
          fillColor,
          strokeColor: fillColor === '#2ECC71' ? '#27AE60' : 
                       fillColor === '#F39C12' ? '#D68910' : 
                       fillColor === '#E74C3C' ? '#C0392B' : '#6c6b6b',
          coordinates: mappedCoords,
          percentEmpty: emptyPercentage,
          status: uiStatus,
          lastUpdatedAt: lot.lastUpdatedAt || null,
          sourceTimestampProvidedByParkzen: lot.sourceTimestampProvidedByParkzen === true,
          captureTimeSource: lot.captureTimeSource || 'none',
          backendFetchedAt: lot.backendFetchedAt || null,
          permitList: lot.permits && Array.isArray(lot.permits) ? lot.permits : [],
          permits: lot.permits && Array.isArray(lot.permits) ? lot.permits.join(',') : 'Unknown'
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
        <LotsContext.Provider value={{ lots, isLoading, lastRefreshAt, fetchLots}}>
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

