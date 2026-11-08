import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import { getNotes } from '../api/notes';
import { getPendingAlerts } from '../api/alerts';
import { classifyNote } from '../utils/eventDates';
import { useAdminNewItemNotifier, useAdminTabTitleCount } from '../hooks/use-admin-web-alerts';

//Live counts of what's waiting on an admin: notes to admin not yet
//acknowledged (badge on the TopBar's notes icon on mobile and the sidebar's
//Notes nav item on web) and commuter hazard reports waiting for review
//(sidebar's Hazards nav item on web). Events have no badge: only admins
//create them, so nothing is ever waiting there.
//Scoped to the admin layout only (not the root app layout) since
//getNotes requires admin auth - a commuter session would just fail this call
//every poll for no reason.
const POLL_MS = 10000;

interface AdminNotesBadgeContextType {
  pendingCount: number;
  pendingHazardCount: number;
  refreshBadge: () => Promise<void>;
}

const AdminNotesBadgeContext = createContext<AdminNotesBadgeContextType | undefined>(undefined);

export function AdminNotesBadgeProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingHazardCount, setPendingHazardCount] = useState(0);
  //web only: browser notification for newly arrived items + count in the tab title
  const notifyNew = useAdminNewItemNotifier();
  useAdminTabTitleCount(pendingCount + pendingHazardCount);

  const refreshBadge = useCallback(async () => {
    //fetched separately so one failing doesn't freeze the other badge;
    //on failure (not an admin yet, or a network hiccup) each keeps its current
    //count rather than flashing it away
    await Promise.all([
      getNotes()
        .then((all: any[]) => {
          const pending = all.filter((n) => classifyNote(n) === 'pending');
          setPendingCount(pending.length);
          notifyNew('notes', pending);
        })
        .catch(() => {}),
      getPendingAlerts('hazard')
        .then((pending: any[]) => {
          setPendingHazardCount(pending.length);
          notifyNew('hazards', pending);
        })
        .catch(() => {}),
    ]);
  }, [notifyNew]);

  useEffect(() => {
    refreshBadge();
    const id = setInterval(refreshBadge, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshBadge();
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [refreshBadge]);

  return (
    <AdminNotesBadgeContext.Provider value={{ pendingCount, pendingHazardCount, refreshBadge }}>
      {children}
    </AdminNotesBadgeContext.Provider>
  );
}

//unlike most context hooks, this one is safe to call with no provider
//mounted (returns a static 0 count) rather than throwing - TopBar is shared
//between the admin and commuter layouts, and only the admin layout mounts
//the provider, so TopBar needs to call this hook unconditionally either way
export const useAdminNotesBadge = (): AdminNotesBadgeContextType => {
  const context = useContext(AdminNotesBadgeContext);
  return context ?? { pendingCount: 0, pendingHazardCount: 0, refreshBadge: async () => {} };
};
