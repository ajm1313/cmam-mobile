/**
 * Age helpers for case registration.
 *
 * Age must always be expressed relative to the *enrolment / registration
 * date*, not to "today". A case registered on paper weeks earlier and entered
 * later would otherwise record an age that is too high, which changes the
 * reporting age band (<6 months, 6-59 months, >=60 months) and the
 * anthropometry Z-score lookups.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse a `YYYY-MM-DD` string as a local-time date, or return null. */
function parseIsoDate(value?: string | null): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

/** Format a Date as `YYYY-MM-DD` in local time (avoids UTC off-by-one). */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Whole months between date of birth and the reference date.
 *
 * @param dob         Date of birth as `YYYY-MM-DD`.
 * @param referenceDate Enrolment/registration date as `YYYY-MM-DD`.
 *                      Falls back to today only when not supplied.
 * @returns Age in completed months, or null when the input is unusable.
 */
export function ageMonthsFromDob(dob?: string | null, referenceDate?: string | null): number | null {
  const birth = parseIsoDate(dob);
  if (!birth) return null;
  const ref = parseIsoDate(referenceDate) ?? new Date();

  let months =
    (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
  // Not yet reached the day-of-month → subtract the incomplete month.
  if (ref.getDate() < birth.getDate()) months--;

  return months < 0 ? null : months;
}

/**
 * Derive an approximate date of birth from an age in months, measured back
 * from the enrolment/registration date.
 *
 * @param ageMonths     Age in completed months.
 * @param referenceDate Enrolment/registration date as `YYYY-MM-DD`.
 * @returns `YYYY-MM-DD` date of birth, or null when the input is unusable.
 */
export function dobFromAgeMonths(
  ageMonths: number | string,
  referenceDate?: string | null,
): string | null {
  const months = typeof ageMonths === 'number' ? ageMonths : parseInt(ageMonths, 10);
  if (Number.isNaN(months) || months < 0) return null;
  const ref = parseIsoDate(referenceDate) ?? new Date();
  const dob = new Date(ref.getFullYear(), ref.getMonth() - months, ref.getDate());
  return toIsoDate(dob);
}
