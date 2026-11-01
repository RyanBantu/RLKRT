// Local astronomy and weather-code helpers (no network).

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

export function moonPhase(date = new Date()) {
  const age = ((((date.getTime() - NEW_MOON_REF) / 86400000) % SYNODIC) + SYNODIC) % SYNODIC;
  const f = age / SYNODIC; // 0 new → 0.5 full → 1 new
  const illum = (1 - Math.cos(2 * Math.PI * f)) / 2;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  const name = names[Math.round(f * 8) % 8];
  return { age, fraction: f, illumination: illum, name, waxing: f < 0.5 };
}

const WMO: Record<number, string> = {
  0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Rain showers', 81: 'Rain showers', 82: 'Violent showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm, hail', 99: 'Thunderstorm, hail',
};
export const skyLabel = (code: number) => WMO[code] ?? 'Unknown';

/** "2026-11-01T07:58" → minutes since local midnight. */
export const isoMinutes = (iso: string) => {
  const [h, m] = iso.slice(11, 16).split(':').map(Number);
  return h * 60 + m;
};
export const fmtClock = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
};
