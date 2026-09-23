import { Alert as RNAlert, Platform } from 'react-native';

//Small shims for two react-native-web gaps that both fail silently:
//1. Alert.alert() is a hardcoded no-op on web (confirmed in its source), so no
//   error/success message or confirmation ever appears and button callbacks never fire.
//2. When EXPO_PUBLIC_API_URL points at an ngrok tunnel (used for on-device testing),
//   ngrok's free tier serves an HTML "you are about to visit..." interstitial — with
//   a 200 status — to any request that looks like it came from a browser, instead of
//   proxying it to the backend. Native app requests don't trigger it (no browser-style
//   headers), which is why both of these only ever broke the web build.

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

//same call signature as RN's Alert.alert, so it's a drop-in replacement
function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons);
    return;
  }

  const text = [title, message].filter(Boolean).join('\n\n');

  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  const cancelButton = buttons.find(b => b.style === 'cancel');
  const confirmButton = buttons.find(b => b.style !== 'cancel') ?? buttons[buttons.length - 1];
  if (window.confirm(text)) {
    confirmButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}

export const Alert = { alert };

//the ngrok-skip header is a no-op against every other host (localhost, Render, Railway, ...)
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'ngrok-skip-browser-warning': 'true',
    },
  });
}
