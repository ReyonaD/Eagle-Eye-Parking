import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

//Keeps calling `callback` every `intervalMs` while this screen is focused and
//the app is in the foreground, pausing otherwise - so an admin reviewing a
//report queue sees new commuter submissions without a manual pull-to-refresh.
//Does NOT call `callback` immediately on focus; pair with the screen's own
//initial fetch (e.g. inside its own useFocusEffect) for that, so the first
//load on a screen can still show its loading spinner while polls stay silent.
export function useFocusPolling(callback: () => void, intervalMs: number = 12000) {
  //always call the latest closure without having to reset the interval/listener
  //whenever the parent re-renders and recreates the callback
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useFocusEffect(
    useCallback(() => {
      const id = setInterval(() => callbackRef.current(), intervalMs);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') callbackRef.current();
      });
      return () => {
        clearInterval(id);
        sub.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [intervalMs])
  );
}
