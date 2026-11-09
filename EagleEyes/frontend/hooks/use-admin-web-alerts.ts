import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { isPushEnabled } from '../utils/pushNotifications';

// Web-only admin extras, using the sidebar badge poll: a browser notification for new
// hazard reports/notes, and the waiting count in the tab title. No-ops on iOS/Android.

const IS_WEB = Platform.OS === 'web' && typeof window !== 'undefined';
const HAS_NOTIFICATIONS = IS_WEB && 'Notification' in window;
const TITLE_COUNT_PREFIX = /^\(\d+\+?\)\s/;

type Kind = 'hazards' | 'notes';
type PendingItem = { id: number | string; title?: string | null; lot_name?: string | null };

const KIND_TEXT: Record<Kind, { one: string; many: (n: number) => string; route: string }> = {
  hazards: { one: 'New hazard report', many: (n) => `${n} new hazard reports`, route: '/(admin)/hazards' },
  notes: { one: 'New note to admin', many: (n) => `${n} new notes to admin`, route: '/(admin)/commuter-notes' },
};

function describe(item: PendingItem): string {
  const title = (item.title || '').trim();
  return item.lot_name ? `${title || 'Report'} · ${item.lot_name}` : title || 'Open the dashboard to review it.';
}

// Ask on the first click: browsers block permission prompts not triggered by the user.
function useAskPermissionOnFirstClick() {
  useEffect(() => {
    if (!HAS_NOTIFICATIONS || Notification.permission !== 'default') return;
    const ask = async () => {
      if (!(await isPushEnabled())) return;
      Notification.requestPermission().catch(() => {});
    };
    window.addEventListener('click', ask, { once: true });
    return () => window.removeEventListener('click', ask);
  }, []);
}

// report(kind, pendingItems) after each poll; the first list is the baseline, not announced.
export function useAdminNewItemNotifier() {
  useAskPermissionOnFirstClick();
  const seenRef = useRef<Record<Kind, Set<string> | null>>({ hazards: null, notes: null });

  return useCallback((kind: Kind, items: PendingItem[]) => {
    if (!IS_WEB) return;
    const ids = items.map((i) => String(i.id));
    const seen = seenRef.current[kind];
    seenRef.current[kind] = new Set([...(seen ?? []), ...ids]);
    if (seen === null) return;

    const fresh = items.filter((i) => !seen.has(String(i.id)));
    if (!fresh.length) return;
    //the admin is already looking at the dashboard - the badge is enough
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    if (!HAS_NOTIFICATIONS || Notification.permission !== 'granted') return;
    //turned off with the Profile "Notifications" switch
    isPushEnabled().then((enabled) => {
      if (enabled) showNotification(kind, fresh);
    });
  }, []);
}

function showNotification(kind: Kind, fresh: PendingItem[]) {
  const text = KIND_TEXT[kind];
  const single = fresh.length === 1 ? fresh[0] : null;
  try {
    const notification = new Notification(single ? text.one : text.many(fresh.length), {
      body: single ? describe(single) : 'Open the dashboard to review them.',
      //a newer one of the same kind replaces the old one instead of stacking
      tag: `parkzen-admin-${kind}`,
    });
    notification.onclick = () => {
      window.focus();
      //a single item opens straight to its detail view (both screens support ?viewId)
      router.push((single ? `${text.route}?viewId=${single.id}` : text.route) as any);
      notification.close();
    };
  } catch {
    //some browsers (e.g. Android Chrome) only allow notifications from a service worker
  }
}

// Keeps "(N) " in the tab title, restoring it after the router rewrites the title.
export function useAdminTabTitleCount(count: number) {
  useEffect(() => {
    if (!IS_WEB) return;
    const apply = () => {
      const base = document.title.replace(TITLE_COUNT_PREFIX, '');
      const wanted = count > 0 ? `(${count > 99 ? '99+' : count}) ${base}` : base;
      if (document.title !== wanted) document.title = wanted;
    };
    apply();

    let titleEl = document.querySelector('title');
    if (!titleEl) {
      titleEl = document.createElement('title');
      document.head.appendChild(titleEl);
    }
    const observer = new MutationObserver(apply);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      //leaving the admin area (e.g. logging out) clears the count
      document.title = document.title.replace(TITLE_COUNT_PREFIX, '');
    };
  }, [count]);
}
