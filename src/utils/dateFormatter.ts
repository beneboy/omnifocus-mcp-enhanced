/**
 * Utility functions for date formatting
 */

export interface DateComponents {
  year: number;
  month: number;
  day: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
}

/**
 * Parse an ISO date string into numeric components.
 * Time components are included when present in the input.
 *
 * @param isoDate ISO date string (e.g., "2026-01-09" or "2026-01-09T14:30:00")
 * @returns Numeric date (and optional time) components
 * @throws Error if the date string is invalid
 */
export function parseDateComponents(isoDate: string): DateComponents {
  if (!isoDate || isoDate.trim() === '') {
    throw new Error('Date string cannot be empty');
  }

  const trimmed = isoDate.trim();
  const fullMatch = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(trimmed);

  if (fullMatch) {
    const [, y, mo, d, h, mi, s] = fullMatch;
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    const validator = new Date(year, month - 1, day);

    if (
      validator.getFullYear() !== year ||
      validator.getMonth() !== month - 1 ||
      validator.getDate() !== day
    ) {
      throw new Error(`Invalid date string: ${isoDate}`);
    }

    const result: DateComponents = { year, month, day };
    if (h !== undefined) {
      result.hours = Number(h);
      result.minutes = Number(mi);
      result.seconds = s !== undefined ? Number(s) : 0;
    }
    return result;
  }

  // Fallback for other Date-parseable inputs.
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date string: ${isoDate}`);
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds()
  };
}

/**
 * Convert an ISO date string to an AppleScript expression that constructs the
 * date from numeric components, avoiding locale-dependent date string parsing.
 *
 * Returns an expression like: my makeDate(2026, 3, 3, 14, 30, 0)
 * Requires the makeDate handler to be included in the AppleScript via
 * APPLESCRIPT_MAKE_DATE_HANDLER.
 *
 * @param isoDate ISO date string (e.g., "2026-01-09" or "2026-01-09T14:30:00")
 * @returns AppleScript expression string
 */
export function formatDateForAppleScript(isoDate: string): string {
  const c = parseDateComponents(isoDate);
  const h = c.hours ?? 0;
  const m = c.minutes ?? 0;
  const s = c.seconds ?? 0;
  return `my makeDate(${c.year}, ${c.month}, ${c.day}, ${h}, ${m}, ${s})`;
}

/**
 * AppleScript handler that constructs a date from year, month, day, hours, minutes, seconds.
 * Include this once in any AppleScript that uses formatDateForAppleScript output.
 */
export const APPLESCRIPT_MAKE_DATE_HANDLER = `
on makeDate(y, m, d, h, mi, s)
  set theDate to current date
  set year of theDate to y
  set month of theDate to m
  set day of theDate to d
  set hours of theDate to h
  set minutes of theDate to mi
  set seconds of theDate to s
  return theDate
end makeDate
`;
