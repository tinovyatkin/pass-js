/**
 * Checks if given string is a valid W3C date representation
 *
 * @param {string} dateStr
 * @returns {boolean}
 */
export function isValidW3CDateString(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  // W3C date format: YYYY-MM-DDThh:mm(:ss)?(Z|±HH:MM)
  // Must match the parser in getDateFromW3CString exactly so the two don't
  // disagree (the parser crashes on strings the validator greenlights).
  // - `$` anchors the whole string, not just the offset branch.
  // - Timezone minutes accept 00–59 (some offsets are :45, e.g. Nepal +05:45,
  //   Chatham Is. +12:45 — the old [03]0 class rejected them).
  return /^20\d{2}-[01]\d-[0-3]\dT[0-5]\d:[0-5]\d(?::[0-5]\d)?(?:Z|[+-][01]\d:[0-5]\d)$/.test(
    dateStr,
  );
}

/**
 * Converts given string or Date instance into valid W3C date string
 *
 * @param {string | Date} value
 * @throws if given string can't be converted into w3C date
 * @returns {string}
 */
export function getW3CDateString(value: string | Date): string {
  if (typeof value !== 'string' && !(value instanceof Date))
    throw new TypeError('Argument must be either a string or Date object');
  if (typeof value === 'string' && isValidW3CDateString(value)) return value;

  const date = value instanceof Date ? value : new Date(value);
  // creating W3C date (we will always do without seconds)
  const month = (1 + date.getMonth()).toFixed().padStart(2, '0');
  const day = date.getDate().toFixed().padStart(2, '0');
  const hours = date.getHours().toFixed().padStart(2, '0');
  const minutes = date.getMinutes().toFixed().padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const offsetHours = Math.abs(Math.floor(offset / 60))
    .toFixed()
    .padStart(2, '0');
  const offsetMinutes = (Math.abs(offset) - parseInt(offsetHours, 10) * 60)
    .toFixed()
    .padStart(2, '0');
  const offsetSign = offset < 0 ? '-' : '+';
  return `${date.getFullYear()}-${month}-${day}T${hours}:${minutes}${offsetSign}${offsetHours}:${offsetMinutes}`;
}

export function getDateFromW3CString(value: string): Date {
  if (!isValidW3CDateString(value))
    throw new TypeError(`Date string ${value} is not a valid W3C date string`);
  // Accept everything the validator accepts: optional seconds, and either
  // `Z` or `±HH:MM` timezone.
  const res =
    /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hours>\d{2}):(?<mins>\d{2})(?::(?<secs>\d{2}))?(?:Z|(?<tzSign>[+-])(?<tzHour>\d{2}):(?<tzMin>\d{2}))$/.exec(
      value,
    );
  if (!res)
    throw new TypeError(`Date string ${value} is not a valid W3C date string`);
  const { year, month, day, hours, mins, secs, tzSign, tzHour, tzMin } =
    res.groups as {
      year: string;
      month: string;
      day: string;
      hours: string;
      mins: string;
      secs?: string;
      tzSign?: '+' | '-';
      tzHour?: string;
      tzMin?: string;
    };
  let utcdate = Date.UTC(
    parseInt(year, 10),
    parseInt(month, 10) - 1, // months are zero-offset
    parseInt(day, 10),
    parseInt(hours, 10),
    parseInt(mins, 10),
    secs ? parseInt(secs, 10) : 0,
  );
  // Apply non-UTC timezone offset if present. `Z` means already UTC.
  if (tzSign && tzHour && tzMin) {
    const offsetMinutes = parseInt(tzHour, 10) * 60 + parseInt(tzMin, 10);
    utcdate += (tzSign === '+' ? -1 : 1) * offsetMinutes * 60000;
  }
  return new Date(utcdate);
}
