import React, { createContext, useState, useContext, ReactNode, useEffect} from 'react';
//define the exact shape of data
interface LotsContextType {
    lots: any[];
    isLoading: boolean;
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
      
      if (!Array.isArray(data)) {
        setLots([]);
        return;
      }

      const formattedLots = data.map((lot: any, index: number) => {
        const mappedCoords = (lot.vertices || []).map((v: any) => ({
          latitude: parseFloat(v.latitude) || parseFloat(v.lat),
          longitude: parseFloat(v.longitude) || parseFloat(v.lng) || parseFloat(v.lon)
        })).filter((v: any) => !isNaN(v.latitude) && !isNaN(v.longitude));

        if (mappedCoords.length === 0) return null;

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
          id: lot.id || index.toString(),
          name: lot.lot_name || lot.name || `Lot ${index}`,
          fillColor: lot.fillColor || 'rgba(53, 53, 53, 0.4)',
          strokeColor: lot.fillColor === '#2ECC71' ? '#27AE60' : 
                       lot.fillColor === '#F39C12' ? '#D68910' : 
                       lot.fillColor === '#E74C3C' ? '#C0392B' : '#6c6b6b',
          coordinates: mappedCoords,
          percentEmpty: emptyPercentage, // Now the UI has the exact number!
          status: uiStatus,              // Now the UI has the exact string!
          permits: lot.permits && Array.isArray(lot.permits) ? lot.permits.join(', ') : 'Unknown'
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

