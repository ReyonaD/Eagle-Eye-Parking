import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAlerts } from '../api/alerts';
import { getMyUpdatesUnreadCount } from '../api/myUpdates';

//device-local "last seen" marker: alerts with an id above this count as new.
//Stored per device so each user's badge reflects what *they* haven't viewed yet.
const LAST_SEEN_KEY = 'alerts_last_seen_id';
// Per-alert read state (separate from the bell); alerts at or below the first-launch
// baseline id count as read.
const READ_BASELINE_KEY = 'alerts_read_baseline_id';
const READ_IDS_KEY = 'alerts_read_ids';
const POLL_MS = 10000;

interface AlertsBadgeContextType {
  unseenCount: number;
  unreadIds: Set<string>;
  refreshBadge: () => Promise<void>;
  markAlertsSeen: () => Promise<void>;
  markAlertRead: (id: string) => Promise<void>;
  //unread "Note Status" entries (an admin acknowledged your
  //note). Server-side read state, unlike the device-local alert ids above.
  myUpdatesUnread: number;
  refreshMyUpdatesUnread: () => Promise<void>;
  //optimistic badge changes while the matching PUT is in flight, so the bell
  //and the Note Status tab drop at the same moment the card does
  markMyUpdateReadLocally: () => void;
  markAllMyUpdatesReadLocally: () => void;
}

const AlertsBadgeContext = createContext<AlertsBadgeContextType | undefined>(undefined);

export function AlertsBadgeProvider({ children }: { children: ReactNode }) {
  const [unseenCount, setUnseenCount] = useState(0);
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const latestMaxId = useRef(0);
  const readIds = useRef<Set<number> | null>(null);
  const [myUpdatesUnread, setMyUpdatesUnread] = useState(0);
  //which login the current count belongs to, so it never carries over to the next account
  const myUpdatesTokenRef = useRef<string | null>(null);
  //bumped on every refresh and local change; a response that comes back after a
  //newer refresh/change (or after a logout) is stale and gets dropped
  const myUpdatesSeqRef = useRef(0);

  const refreshMyUpdatesUnread = useCallback(async () => {
    const seq = ++myUpdatesSeqRef.current;
    try {
      const token = await AsyncStorage.getItem('token');
      if (token !== myUpdatesTokenRef.current) {
        //logged out or switched accounts: drop the previous user's count right away
        myUpdatesTokenRef.current = token;
        setMyUpdatesUnread(0);
      }
      if (!token) return;
      //returns 0 without a request when logged in as an admin
      const count = await getMyUpdatesUnreadCount();
      if (seq === myUpdatesSeqRef.current && myUpdatesTokenRef.current === token) {
        setMyUpdatesUnread(count);
      }
    } catch {
      //network hiccup: keep the current count rather than flashing it away
    }
  }, []);

  const markMyUpdateReadLocally = useCallback(() => {
    myUpdatesSeqRef.current++;
    setMyUpdatesUnread((count) => Math.max(0, count - 1));
  }, []);

  const markAllMyUpdatesReadLocally = useCallback(() => {
    myUpdatesSeqRef.current++;
    setMyUpdatesUnread(0);
  }, []);

  //login, logout and account switches all move between route groups (login ->
  //(tabs), (tabs) -> login), so refresh right then instead of waiting for the poll
  const firstSegment = useSegments()[0];
  useEffect(() => {
    refreshMyUpdatesUnread();
  }, [firstSegment, refreshMyUpdatesUnread]);

  const refreshBadge = useCallback(async () => {
    //rides along with every existing refresh trigger (poll, foreground, tab focus)
    refreshMyUpdatesUnread();
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
  }, [refreshMyUpdatesUnread]);

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
    <AlertsBadgeContext.Provider value={{ unseenCount, unreadIds, refreshBadge, markAlertsSeen, markAlertRead, myUpdatesUnread, refreshMyUpdatesUnread, markMyUpdateReadLocally, markAllMyUpdatesReadLocally }}>
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
