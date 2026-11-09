import { Alert as RNAlert, Platform } from 'react-native';

// Web shims: Alert.alert is a no-op on react-native-web, and ngrok serves a browser
// interstitial unless the skip header is sent.

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

// Called on 401 or 403 "admin_revoked" for authenticated requests (set by SessionWatcher).
type AuthFailureHandler = () => void;
let authFailureHandler: AuthFailureHandler | null = null;
export function setAuthFailureHandler(handler: AuthFailureHandler | null) {
  authFailureHandler = handler;
}

function hasAuthHeader(headers: HeadersInit | undefined): boolean {
  if (!headers) return false;
  if (typeof Headers !== 'undefined' && headers instanceof Headers) return headers.has('Authorization');
  if (Array.isArray(headers)) return headers.some(([key]) => key.toLowerCase() === 'authorization');
  return Object.keys(headers).some((key) => key.toLowerCase() === 'authorization');
}

async function checkAuthFailure(response: Response) {
  if (!authFailureHandler) return;
  if (response.status === 401) {
    authFailureHandler();
    return;
  }
  if (response.status === 403) {
    try {
      //clone so the caller can still read the body itself
      const data = await response.clone().json();
      if (data?.detail === 'admin_revoked') authFailureHandler();
    } catch {
      // not JSON - not ours to handle
    }
  }
}

//the ngrok-skip header is a no-op against every other host (localhost, Render, Railway, ...)
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      'ngrok-skip-browser-warning': 'true',
    },
  });
  //only requests sent with a token: a 401 from /login just means a wrong password
  if (hasAuthHeader(init.headers)) checkAuthFailure(response);
  return response;
}
