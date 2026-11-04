import { addDays, isIsoDate, localDate, localTime, localToInstant } from './time-utils.js';

describe('localToInstant', () => {
  it('converts Istanbul (fixed +03:00) wall-clock time', () => {
    expect(localToInstant('2026-11-04', '06:05', 'Europe/Istanbul').toISOString()).toBe(
      '2026-11-04T03:05:00.000Z',
    );
  });

  it('respects London summer and winter time', () => {
    expect(localToInstant('2026-07-01', '12:00', 'Europe/London').toISOString()).toBe(
      '2026-07-01T11:00:00.000Z',
    );
    expect(localToInstant('2026-12-01', '12:00', 'Europe/London').toISOString()).toBe(
      '2026-12-01T12:00:00.000Z',
    );
  });

  it('handles the day of a DST change (Europe/Berlin, 2026-10-25)', () => {
    // 01:30 is still summer time (+02:00); 05:00 is winter time (+01:00).
    expect(localToInstant('2026-10-25', '01:30', 'Europe/Berlin').toISOString()).toBe(
      '2026-10-24T23:30:00.000Z',
    );
    expect(localToInstant('2026-10-25', '05:00', 'Europe/Berlin').toISOString()).toBe(
      '2026-10-25T04:00:00.000Z',
    );
  });

  it('handles negative offsets', () => {
    expect(localToInstant('2026-01-15', '18:00', 'America/New_York').toISOString()).toBe(
      '2026-01-15T23:00:00.000Z',
    );
  });
});

describe('localDate / localTime', () => {
  it('gives the calendar day in the zone, not UTC', () => {
    const instant = new Date('2026-11-04T22:30:00Z');
    expect(localDate(instant, 'Europe/Istanbul')).toBe('2026-11-05');
    expect(localTime(instant, 'Europe/Istanbul')).toBe('01:30');
    expect(localDate(instant, 'America/New_York')).toBe('2026-11-04');
  });
});

describe('date helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-11-04')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('04.11.2026')).toBe(false);
  });
});
