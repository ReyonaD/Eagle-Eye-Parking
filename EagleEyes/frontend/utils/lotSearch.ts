// Lot search ranking for the lot picker.

// "Lot 20" -> "lot20"; punctuation/spacing never decides a match
const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
// "Lot 20" -> "20", "Garage 3" -> "3": people usually type just the number
const stripKind = (text: string) => normalize(text).replace(/^(lot|garage|parking)/, '');

/** Match rank (lower is better, null = no match): 0 exact, 1 prefix, 2 word prefix, 3 contains. */
export function matchScore(lot: { name: string; tag: string }, query: string): number | null {
  const q = normalize(query);
  if (!q) return null;
  const name = normalize(lot.name);
  const bare = stripKind(lot.name);
  const tag = normalize(lot.tag || '');
  if (name === q || bare === q || tag === q) return 0;
  if (name.startsWith(q) || bare.startsWith(q) || tag.startsWith(q)) return 1;
  const words = lot.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (words.some((word) => word.startsWith(q))) return 2;
  if (name.includes(q)) return 3;
  return null;
}

/** Lots matching `query`, best match first, then nearest (by `distance`). */
export function rankLotMatches<T extends { name: string; tag: string; distance: number }>(lots: T[], query: string): T[] {
  return lots
    .map((lot) => ({ lot, score: matchScore(lot, query) }))
    .filter((entry): entry is { lot: T; score: number } => entry.score !== null)
    .sort((a, b) => a.score - b.score || a.lot.distance - b.lot.distance)
    .map((entry) => entry.lot);
}
