import { useCallback, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

// On web, skip ticks while the tab is hidden or the browser is offline (laptop asleep,
// Wi-Fi dropped): every one would just fail.
function canPoll(): boolean {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return true;
  if (document.visibilityState === 'hidden') return false;
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

// Calls `callback` every `intervalMs` while the screen is focused and the app is in the
// foreground, and right away when the app comes back (or, on web, the connection does).
// Doesn't fire on focus; do the initial fetch separately.
export function useFocusPolling(callback: () => void, intervalMs: number = 12000) {
  //always call the latest closure without having to reset the interval/listener
  //whenever the parent re-renders and recreates the callback
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useFocusEffect(
    useCallback(() => {
      const tick = () => {
        if (canPoll()) callbackRef.current();
      };
      const id = setInterval(tick, intervalMs);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') tick();
      });
      const onOnline = () => tick();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('online', onOnline);
      return () => {
        clearInterval(id);
        sub.remove();
        if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('online', onOnline);
      };
    }, [intervalMs])
  );
}
