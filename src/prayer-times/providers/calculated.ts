import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';
import { addDays, localTime } from '../time-utils.js';
import type { ProviderDay } from './provider.js';

/**
 * Local astronomical calculation with adhan's Diyanet-compatible parameters.
 * Used only when the upstream source is unreachable and nothing is cached, or for
 * places with no nearby district. Agrees with Diyanet's published tables to about
 * a minute in Türkiye; responses using it are labelled `source: "calculated"`.
 */
export function calculateDays(
  lat: number,
  lng: number,
  timeZone: string,
  from: string,
  count: number,
): ProviderDay[] {
  const coordinates = new Coordinates(lat, lng);
  const params = CalculationMethod.Turkey();
  const days: ProviderDay[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = addDays(from, i);
    const [year, month, day] = date.split('-').map(Number) as [number, number, number];
    // adhan reads the Y/M/D of the Date in local process time; build it explicitly.
    const times = new PrayerTimes(coordinates, new Date(year, month - 1, day), params);
    days.push({
      date,
      imsak: localTime(times.fajr, timeZone),
      gunes: localTime(times.sunrise, timeZone),
      ogle: localTime(times.dhuhr, timeZone),
      ikindi: localTime(times.asr, timeZone),
      aksam: localTime(times.maghrib, timeZone),
      yatsi: localTime(times.isha, timeZone),
    });
  }
  return days;
}
