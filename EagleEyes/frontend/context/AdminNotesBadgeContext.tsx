import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import { getNotes } from '../api/notes';
import { getPendingAlerts } from '../api/alerts';
import { classifyNote } from '../utils/eventDates';
import { useAdminNewItemNotifier, useAdminTabTitleCount } from '../hooks/use-admin-web-alerts';

// Counts waiting on an admin: unacknowledged notes and pending hazard reports.
// Mounted only in the admin layout (the endpoints need admin auth).
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
    // Fetched separately so one failure doesn't freeze the other; keep counts on error.
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

// Safe without a provider (returns 0): TopBar is shared with the commuter layout.
export const useAdminNotesBadge = (): AdminNotesBadgeContextType => {
  const context = useContext(AdminNotesBadgeContext);
  return context ?? { pendingCount: 0, pendingHazardCount: 0, refreshBadge: async () => {} };
};
