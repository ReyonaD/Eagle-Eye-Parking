//In-memory copy of the app's recent console output, so a user can send it to us
//from Help & Support (api/logs.js) when something breaks on their device that we
//can't reproduce (e.g. the Android map not showing).
//
//Imported for its side effect as the FIRST import in app/_layout.tsx, so it wraps
//console.* before any other module logs anything. Only JS-side output is captured:
//native-only messages (like Google Maps SDK auth failures) go to logcat, not here.

type Level = 'log' | 'info' | 'warn' | 'error' | 'debug';

const MAX_ENTRIES = 1500;
const MAX_LINE_LENGTH = 4000;
const LEVELS: Level[] = ['log', 'info', 'warn', 'error', 'debug'];

const entries: string[] = [];

//never ship credentials to the backend, even if some screen logs them by mistake
function redact(text: string): string {
  return text
    .replace(/Bearer\s+[\w\-.~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(
      //true/false/null are left alone: "Has token: true" is useful and not a secret
      /("?(?:password|new_password|token|access_token|refresh_token|authorization)"?\s*[:=]\s*)("[^"]*"|'[^']*'|(?!(?:true|false|null)\b)[^\s&,}]+)/gi,
      '$1[REDACTED]'
    );
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  if (arg === undefined) return 'undefined';
  try {
    const seen = new WeakSet();
    return JSON.stringify(arg, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    });
  } catch {
    return String(arg);
  }
}

function record(level: string, args: unknown[]) {
  let line = `${new Date().toISOString()} [${level.toUpperCase()}] ${redact(args.map(formatArg).join(' '))}`;
  if (line.length > MAX_LINE_LENGTH) line = `${line.slice(0, MAX_LINE_LENGTH)}… [truncated]`;
  entries.push(line);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
}

//guard so Fast Refresh re-evaluating this module doesn't wrap console twice
const globalAny = globalThis as any;
if (!globalAny.__eagleLogCaptureInstalled) {
  globalAny.__eagleLogCaptureInstalled = true;

  for (const level of LEVELS) {
    const original = console[level]?.bind(console);
    if (!original) continue;
    console[level] = (...args: unknown[]) => {
      try {
        record(level, args);
      } catch {
        //logging must never break the app
      }
      original(...args);
    };
  }

  //uncaught JS errors (the red-screen / silent crash kind) bypass console in release builds
  const errorUtils = globalAny.ErrorUtils;
  if (errorUtils?.getGlobalHandler && errorUtils?.setGlobalHandler) {
    const previousHandler = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      record(isFatal ? 'fatal' : 'uncaught', [error]);
      previousHandler?.(error, isFatal);
    });
  }

  record('info', ['[LogCapture] started']);
}

export function getCapturedLogs(): string {
  return entries.join('\n');
}

export function getCapturedLogCount(): number {
  return entries.length;
}
