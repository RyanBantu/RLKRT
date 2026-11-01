import { getJSON, r4 } from './http';
import type { LatLng } from '../geo';

// Open-Meteo forecast API: https://open-meteo.com/en/docs — no key; CC BY 4.0 attribution.
// Always fetched in metric; the panel converts for display so the unit toggle needs no refetch.

export type Weather = {
  timezone: string;
  utcOffsetSeconds: number;
  current: {
    time: string;
    temperature: number; // °C
    feelsLike: number;
    code: number;
    isDay: boolean;
    windSpeed: number; // km/h
    windGusts: number;
    windDir: number; // degrees, direction the wind comes FROM
    precip: number; // mm in the last interval
    pressure: number; // hPa, mean sea level
  };
  /** Next 24 h, starting at the current hour. */
  hourly: { time: string; precip: number; prob: number | null; temp: number }[];
  /** Pressure 6 h ago (hPa), for the trend. */
  pressure6hAgo: number | null;
  sunrise: string; // local ISO, e.g. 2026-11-01T07:58
  sunset: string;
  tomorrowSunrise: string | null;
};

type Raw = {
  timezone: string;
  utc_offset_seconds: number;
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    is_day: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    wind_direction_10m: number;
    precipitation: number;
    pressure_msl: number;
  };
  hourly: { time: string[]; precipitation: number[]; precipitation_probability: (number | null)[]; pressure_msl: number[]; temperature_2m: number[] };
  daily: { time: string[]; sunrise: string[]; sunset: string[] };
};

export async function getWeather(p: LatLng): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${r4(p.lat)}&longitude=${r4(p.lng)}` +
    '&current=temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,precipitation,pressure_msl' +
    '&hourly=precipitation,precipitation_probability,pressure_msl,temperature_2m' +
    '&daily=sunrise,sunset&timezone=auto&past_hours=6&forecast_hours=25&forecast_days=2';
  const raw = await getJSON<Raw>(url);
  const h = raw.hourly;
  const nowHour = raw.current.time.slice(0, 13); // "YYYY-MM-DDTHH"
  let i0 = h.time.findIndex((t) => t.startsWith(nowHour));
  if (i0 < 0) i0 = Math.min(6, h.time.length - 1);
  const hourly = h.time.slice(i0, i0 + 24).map((time, k) => ({
    time,
    precip: h.precipitation[i0 + k] ?? 0,
    prob: h.precipitation_probability[i0 + k] ?? null,
    temp: h.temperature_2m[i0 + k],
  }));
  const c = raw.current;
  return {
    timezone: raw.timezone,
    utcOffsetSeconds: raw.utc_offset_seconds,
    current: {
      time: c.time,
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      code: c.weather_code,
      isDay: c.is_day === 1,
      windSpeed: c.wind_speed_10m,
      windGusts: c.wind_gusts_10m,
      windDir: c.wind_direction_10m,
      precip: c.precipitation,
      pressure: c.pressure_msl,
    },
    hourly,
    pressure6hAgo: i0 >= 6 ? h.pressure_msl[i0 - 6] : null,
    sunrise: raw.daily.sunrise[0],
    sunset: raw.daily.sunset[0],
    tomorrowSunrise: raw.daily.sunrise[1] ?? null,
  };
}
