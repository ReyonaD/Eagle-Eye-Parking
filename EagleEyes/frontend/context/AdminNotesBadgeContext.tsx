import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AppState } from 'react-native';
import { getNotes } from '../api/notes';
import { classifyNote } from '../utils/eventDates';

//Live count of notes to admin still waiting on acknowledgment, shown as a
//badge on the admin TopBar's notes icon (mobile) and the sidebar's Notes nav
//item (web). Scoped to the admin layout only (not the root app layout) since
//getNotes requires admin auth - a commuter session would just fail this call
//every poll for no reason.
const POLL_MS = 10000;

interface AdminNotesBadgeContextType {
  pendingCount: number;
  refreshBadge: () => Promise<void>;
}

const AdminNotesBadgeContext = createContext<AdminNotesBadgeContextType | undefined>(undefined);

export function AdminNotesBadgeProvider({ children }: { children: ReactNode }) {
  const [pendingCount, setPendingCount] = useState(0);

  const refreshBadge = useCallback(async () => {
    try {
      const all = await getNotes();
      const pending = all.filter((n: any) => classifyNote(n) === 'pending');
      setPendingCount(pending.length);
    } catch {
      //not an admin yet, or a network hiccup - keep the current badge rather than flashing it away
    }
  }, []);

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
    <AdminNotesBadgeContext.Provider value={{ pendingCount, refreshBadge }}>
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
  return context ?? { pendingCount: 0, refreshBadge: async () => {} };
};
