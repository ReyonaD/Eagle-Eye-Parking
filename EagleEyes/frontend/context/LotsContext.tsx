import React, { createContext, useState, useContext, ReactNode, useEffect} from 'react';
//define the exact shape of data
interface LotsContextType {
    lots: any[];
    isLoading: boolean;
    fetchLots: () => Promise<void>;
}

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

function isCampusLot(lot: any): boolean {
  const sourceName = String(lot.lot_name || lot.name || '').trim();
  const sourceId = String(lot.id || '').toLowerCase();
  const searchableName = `${sourceId} ${sourceName}`.toLowerCase();

  if (/on[-\s]?street|street\s+parking/.test(searchableName)) return false;

  const normalizedName = sourceName.toLowerCase();
  const isHsg = sourceId === 'hsg' || normalizedName === 'hsg';
  const hasTwoDigitLotNumber = /\b\d{2}\b/.test(searchableName);

  return isHsg || hasTwoDigitLotNumber;
}

//defind the props for the Provider
//expect to receive standard React components inside the children variable
interface LotsProviderProps {
    children: ReactNode;
}

export function LotsProvider({ children }: { children : ReactNode }) {
    const [lots, setLots] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);//start fetching as app opens

    const fetchLots = async () => {
    try {
      setIsLoading(true);
      const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL;
      
      const response = await fetch(`${BACKEND_URL}/api/lots`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true'}
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

        // Read the Backend's Occupancy Estimate
        let emptyPercentage = null;
        if (lot.occupancy && lot.occupancy.lastUpdatedVia) {
           const method = lot.occupancy.lastUpdatedVia; // e.g., 'capstone_simulation'
           if (lot.occupancy[method] && lot.occupancy[method].estimate !== undefined) {
               // The backend estimate is % FULL (e.g., 0.85). We want % EMPTY.
               const percentFullDecimal = lot.occupancy[method].estimate;
               emptyPercentage = Math.round((1 - percentFullDecimal) * 100); 
           }
        }

        // Translate Backend Status to UI Status
        let uiStatus = 'Available';
        if (lot.infoSheetTitle === 'Full') {
          uiStatus = 'Full';
        } else if (lot.infoSheetTitle === 'Medium') {
          uiStatus = 'Near Capacity'; // Maps the backend "Medium" to UI's yellow badge
        }

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
          percentEmpty: emptyPercentage, // Now the UI has the exact number!
          status: uiStatus,              // Now the UI has the exact string!
          permitList: lot.permits && Array.isArray(lot.permits) ? lot.permits : [],
          permits: lot.permits && Array.isArray(lot.permits) ? lot.permits.join(',') : 'Unknown'
        };
      }).filter((lot: any) => lot !== null);

      setLots(formattedLots);
    } catch (error) {
      console.error("Error fetching lots:", error);
      setLots([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically fetch when the app opens
  useEffect(() => {
    fetchLots();
  }, []);
    return (
        <LotsContext.Provider value={{ lots, isLoading, fetchLots}}>
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

