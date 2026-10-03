// Note to Admin — frontend API boundary.
//
// This file is the ONLY place Note-to-Admin screens are allowed to talk to
// the network (same isolation convention as api/alerts.js and api/auth.js).
// It intentionally does NOT call any endpoint yet: Monica owns the backend
// for this feature and hasn't shared the API contract (routes, payload field
// names, response shape, status values, or the acknowledge endpoint) yet.
//
// Do not guess that contract here. Do not reuse /alerts or createAlert() —
// Note to Admin is architecturally separate from Alerts. Do not fake a
// successful response. Until the contract exists, nothing in the UI should
// actually call createNote() — see the disabled Submit button on the Review
// screen in app/report-note.tsx.
//
// TODO (blocked on Monica's API contract): implement this as a real request
// once the endpoint, payload shape, and response format are confirmed, e.g.
//   export const createNote = async (noteData) => {
//     const token = await AsyncStorage.getItem('token');
//     const response = await apiFetch(`${BASE_URL}/notes`, { ... });
//     ...
//   };
//
// Expected shape of `noteData` once wired (matches the fields collected by
// the Note to Admin form per DDS2 pages 11-12 — field names here are a draft
// for our own use and may need to change to match Monica's actual schema):
//   {
//     reason: string,
//     detail?: string,
//     lotName?: string,
//     startTime: string,
//     endTime: { mode: '24hr' | 'endOfDay' | 'overnight' | 'custom', date?: string, time?: string },
//     licensePlateState: string,
//     licensePlateNumber: string,
//     phoneNumber: string,
//     photoUri?: string,
//   }
//
// Not implemented yet, and not called by any screen yet (the Review screen's
// Submit button is disabled rather than wired to this). Left as a documented
// placeholder only — no request, no thrown error, no fake success.
export const createNote = async (noteData) => {
  // Intentionally empty: see TODO above.
};
