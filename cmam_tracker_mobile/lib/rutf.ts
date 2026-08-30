/**
 * RUTF (Ready-to-Use Therapeutic Food) ration lookup.
 *
 * Single source of truth for the weight-band → sachet ration table used by the
 * registration form, the visit form and the visit edit form.
 *
 * Reference: Ghana CMAM Interim National Guidelines / WHO-UNICEF joint
 * statement, based on 92 g (500 kcal) sachets delivering ~200 kcal/kg/day.
 *
 *   Weight (kg)   Sachets/day   Sachets/week
 *   3.5 – 3.9        1½              11
 *   4.0 – 5.4         2              14
 *   5.5 – 6.9        2½              18
 *   7.0 – 8.4         3              21
 *   8.5 – 9.4        3½              25
 *   9.5 – 10.4        4              28
 *   10.5 – 11.9      4½              32
 *   >= 12             5              35
 *
 * Children below 3.5 kg are not rationed here — they require inpatient care.
 */

export interface RutfBand {
  /** Lower bound of the weight band, inclusive (kg). */
  minWeight: number;
  /** Human-readable weight range for the on-screen guide. */
  weight: string;
  /** Sachets per week. */
  week: number;
  /** Sachets per day, formatted for display. */
  day: string;
  /** Sachets per day as a number, for prefilling numeric fields. */
  perDay: number;
}

/** Ordered from the heaviest band down, so the first match wins. */
const RUTF_BANDS: RutfBand[] = [
  { minWeight: 12.0, weight: '12+', week: 35, day: '5', perDay: 5 },
  { minWeight: 10.5, weight: '10.5 – 11.9', week: 32, day: '4½', perDay: 4.5 },
  { minWeight: 9.5, weight: '9.5 – 10.4', week: 28, day: '4', perDay: 4 },
  { minWeight: 8.5, weight: '8.5 – 9.4', week: 25, day: '3½', perDay: 3.5 },
  { minWeight: 7.0, weight: '7.0 – 8.4', week: 21, day: '3', perDay: 3 },
  { minWeight: 5.5, weight: '5.5 – 6.9', week: 18, day: '2½', perDay: 2.5 },
  { minWeight: 4.0, weight: '4.0 – 5.4', week: 14, day: '2', perDay: 2 },
  { minWeight: 3.5, weight: '3.5 – 3.9', week: 11, day: '1½', perDay: 1.5 },
];

/** Minimum weight that receives an outpatient RUTF ration. */
export const RUTF_MIN_WEIGHT_KG = 3.5;

/** Guide table for display, lightest band first. */
export const RUTF_GUIDE: RutfBand[] = [...RUTF_BANDS].reverse();

/** Resolve the band for a weight, or null when below the outpatient threshold. */
export function rutfBandForWeight(weightKg: number): RutfBand | null {
  if (!Number.isFinite(weightKg)) return null;
  return RUTF_BANDS.find((b) => weightKg >= b.minWeight) ?? null;
}

/**
 * Sachets per week for a given weight.
 * Returns null when the weight is below 3.5 kg or invalid.
 */
export function calcRutf(weightKg: number): number | null {
  return rutfBandForWeight(weightKg)?.week ?? null;
}

/**
 * Sachets per day for a given weight.
 * Returns null when the weight is below 3.5 kg or invalid.
 */
export function calcRutfPerDay(weightKg: number): number | null {
  return rutfBandForWeight(weightKg)?.perDay ?? null;
}
