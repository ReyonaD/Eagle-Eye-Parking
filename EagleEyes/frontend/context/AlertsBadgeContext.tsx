import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAlerts } from '../api/alerts';

//device-local "last seen" marker: alerts with an id above this count as new.
//Stored per device so each user's badge reflects what *they* haven't viewed yet.
const LAST_SEEN_KEY = 'alerts_last_seen_id';
const POLL_MS = 10000;

interface AlertsBadgeContextType {
  unseenCount: number;
  refreshBadge: () => Promise<void>;
  markAlertsSeen: () => Promise<void>;
}

const AlertsBadgeContext = createContext<AlertsBadgeContextType | undefined>(undefined);

export function AlertsBadgeProvider({ children }: { children: ReactNode }) {
  const [unseenCount, setUnseenCount] = useState(0);
  const latestMaxId = useRef(0);

  const refreshBadge = useCallback(async () => {
    try {
      const [hazards, events] = await Promise.all([
        getAlerts('hazard').catch(() => []),
        getAlerts('event').catch(() => []),
      ]);
      const ids = [...hazards, ...events].map((a: any) => Number(a.id)).filter(n => !isNaN(n));
      const maxId = ids.length ? Math.max(...ids) : 0;
      latestMaxId.current = maxId;

      const stored = await AsyncStorage.getItem(LAST_SEEN_KEY);
      if (stored === null) {
        //first launch: don't greet the user with a huge backlog badge
        await AsyncStorage.setItem(LAST_SEEN_KEY, String(maxId));
        setUnseenCount(0);
        return;
      }
      const lastSeen = Number(stored) || 0;
      setUnseenCount(ids.filter(id => id > lastSeen).length);
    } catch {
      //network hiccup: keep the current badge rather than flashing it away
    }
  }, []);

  const markAlertsSeen = useCallback(async () => {
    await AsyncStorage.setItem(LAST_SEEN_KEY, String(latestMaxId.current));
    setUnseenCount(0);
  }, []);

  useEffect(() => {
    refreshBadge();
    const id = setInterval(refreshBadge, POLL_MS);
    //also check immediately whenever the app returns to the foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshBadge();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [refreshBadge]);

  return (
    <AlertsBadgeContext.Provider value={{ unseenCount, refreshBadge, markAlertsSeen }}>
      {children}
    </AlertsBadgeContext.Provider>
  );
}

export const useAlertsBadge = () => {
  const context = useContext(AlertsBadgeContext);
  if (context === undefined) {
    throw new Error('useAlertsBadge must be used within an AlertsBadgeProvider');
  }
  return context;
};
