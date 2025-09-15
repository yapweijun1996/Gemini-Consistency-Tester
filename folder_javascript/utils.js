export const sleep = ms => new Promise(r => setTimeout(r, ms));

export function normalizeText(s) {
  if (typeof s !== 'string') return '';
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function truncate(s, len = 220) {
  if (!s) return '';
  return s.length > len ? s.slice(0, len) + '…' : s;
}

export function jaccard(a, b) {
  const setA = new Set(a.toLowerCase().match(/\w+/g) || []);
  const setB = new Set(b.toLowerCase().match(/\w+/g) || []);
  const inter = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 1 : inter.size / union.size;
}

export function majority(strings) {
  const map = new Map();
  for (const s of strings) {
    map.set(s, (map.get(s) || 0) + 1);
  }
  let best = '', bestCount = 0;
  for (const [s, c] of map) {
    if (c > bestCount) {
      best = s;
      bestCount = c;
    }
  }
  return { value: best, count: bestCount };
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 KB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '–';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function formatShortTime(isoString) {
  if (!isoString) return '–';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}