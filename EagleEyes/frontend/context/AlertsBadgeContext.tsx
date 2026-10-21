import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAlerts } from '../api/alerts';

//device-local "last seen" marker: alerts with an id above this count as new.
//Stored per device so each user's badge reflects what *they* haven't viewed yet.
const LAST_SEEN_KEY = 'alerts_last_seen_id';
//per-alert "read" state, separate from the bell's last-seen marker: visiting the
//Alerts tab clears the bell, but an alert stays unread until it's actually opened.
//Alerts at or below the baseline id (whatever existed on first launch) count as read.
const READ_BASELINE_KEY = 'alerts_read_baseline_id';
const READ_IDS_KEY = 'alerts_read_ids';
const POLL_MS = 10000;

interface AlertsBadgeContextType {
  unseenCount: number;
  unreadIds: Set<string>;
  refreshBadge: () => Promise<void>;
  markAlertsSeen: () => Promise<void>;
  markAlertRead: (id: string) => Promise<void>;
}

const AlertsBadgeContext = createContext<AlertsBadgeContextType | undefined>(undefined);

export function AlertsBadgeProvider({ children }: { children: ReactNode }) {
  const [unseenCount, setUnseenCount] = useState(0);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const latestMaxId = useRef(0);
  const readIds = useRef<Set<number> | null>(null);

  const refreshBadge = useCallback(async () => {
    try {
      let fetchFailed = false;
      const [hazards, events] = await Promise.all([
        getAlerts('hazard').catch(() => { fetchFailed = true; return []; }),
        getAlerts('event').catch(() => { fetchFailed = true; return []; }),
      ]);
      const ids = [...hazards, ...events].map((a: any) => Number(a.id)).filter(n => !isNaN(n));
      const maxId = ids.length ? Math.max(...ids) : 0;
      latestMaxId.current = maxId;

      const stored = await AsyncStorage.getItem(LAST_SEEN_KEY);
      let baselineStored = await AsyncStorage.getItem(READ_BASELINE_KEY);
      if (baselineStored === null) {
        //existing installs start from their last-seen marker so alerts they
        //haven't looked at yet still show as unread; fresh installs start clean
        baselineStored = stored ?? String(maxId);
        await AsyncStorage.setItem(READ_BASELINE_KEY, baselineStored);
      }
      const baseline = Number(baselineStored) || 0;
      if (readIds.current === null) {
        const raw = await AsyncStorage.getItem(READ_IDS_KEY);
        readIds.current = new Set<number>(raw ? JSON.parse(raw) : []);
      }
      //drop read ids for alerts that are gone from the feed so the list doesn't grow forever
      //(skipped on a failed fetch, where a missing alert doesn't mean it was deleted)
      if (!fetchFailed) {
        const live = new Set(ids);
        readIds.current = new Set([...readIds.current].filter(id => live.has(id)));
      }
      const read = readIds.current;
      setUnreadIds(new Set(ids.filter(id => id > baseline && !read.has(id)).map(String)));

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

  const markAlertRead = useCallback(async (id: string) => {
    setUnreadIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    const read = readIds.current ?? new Set<number>();
    read.add(Number(id));
    readIds.current = read;
    await AsyncStorage.setItem(READ_IDS_KEY, JSON.stringify([...read]));
  }, []);

  useEffect(() => {
    refreshBadge();
    const id = setInterval(refreshBadge, POLL_MS);
    //also check immediately whenever the app returns to the foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshBadge();
    });
    //an alert push arriving while the app is open means the feed just changed
    const pushSub = Platform.OS !== 'web'
      ? Notifications.addNotificationReceivedListener(() => refreshBadge())
      : null;
    return () => {
      clearInterval(id);
      sub.remove();
      pushSub?.remove();
    };
  }, [refreshBadge]);

  return (
    <AlertsBadgeContext.Provider value={{ unseenCount, unreadIds, refreshBadge, markAlertsSeen, markAlertRead }}>
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
