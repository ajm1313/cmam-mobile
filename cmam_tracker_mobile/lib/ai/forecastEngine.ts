/**
 * Offline Stock Demand Forecasting Engine
 *
 * Mirrors the backend forecast_engine.py logic for on-device forecasting.
 * Uses weighted moving average + trend detection on cached consumption data.
 */

export interface WeeklyConsumption {
  weekStart: string;
  weekEnd: string;
  totalConsumed: number;
}

export interface ForecastPeriod {
  week: number;
  weekStart: string;
  weekEnd: string;
  predictedDemand: number;
  lowerBound: number;
  upperBound: number;
}

export interface StockForecastResult {
  itemName: string;
  itemId: number;
  currentStock: number;
  forecastPeriods: ForecastPeriod[];
  totalForecast: number;
  daysUntilStockout: number | null;
  reorderRecommended: boolean;
  recommendedQuantity: number;
  method: string;
  accuracyScore: number | null;
  reorderLevel: number;
  message?: string;
}

const FORECAST_WEEKS = 8;
const WMA_WEIGHTS = [0.4, 0.3, 0.2, 0.1];

export function forecastStock(
  weeklyConsumption: WeeklyConsumption[],
  currentStock: number,
  reorderLevel: number,
  itemName: string,
  itemId: number,
): StockForecastResult {
  if (!weeklyConsumption || weeklyConsumption.length < 2) {
    return {
      itemName,
      itemId,
      currentStock,
      forecastPeriods: [],
      totalForecast: 0,
      daysUntilStockout: null,
      reorderRecommended: currentStock < reorderLevel,
      recommendedQuantity: Math.max(0, reorderLevel * 2 - currentStock),
      method: 'insufficient_data',
      accuracyScore: null,
      reorderLevel,
      message: 'Insufficient historical data for forecasting (need 2+ weeks)',
    };
  }

  const consumptions = weeklyConsumption.map(w => w.totalConsumed);
  const n = consumptions.length;

  // Calculate trend (linear regression slope)
  let slope = 0;
  if (n >= 3) {
    const xMean = (n - 1) / 2;
    const yMean = consumptions.reduce((a, b) => a + b, 0) / n;
    const numerator = consumptions.reduce((sum, y, i) => sum + (i - xMean) * (y - yMean), 0);
    const denominator = Array.from({ length: n }, (_, i) => (i - xMean) ** 2).reduce((a, b) => a + b, 0);
    slope = denominator !== 0 ? numerator / denominator : 0;
  }

  // WMA from last 4 weeks
  const recent = consumptions.slice(-4);
  const weights = WMA_WEIGHTS.slice(0, recent.length);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const wma = weightSum > 0 ? weights.reduce((sum, w, i) => sum + w * recent[i], 0) / weightSum : 0;

  // Generate forecast
  const forecastPeriods: ForecastPeriod[] = [];
  const today = new Date();

  const stdDev = calculateStdDev(consumptions);

  for (let i = 0; i < FORECAST_WEEKS; i++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (i + 1) * 7 - 6);
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + (i + 1) * 7);

    const predicted = Math.max(0, Math.round(wma + slope * (i + 1)));
    const margin = Math.round(stdDev * (1 + i * 0.15));

    forecastPeriods.push({
      week: i + 1,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      predictedDemand: predicted,
      lowerBound: Math.max(0, predicted - margin),
      upperBound: predicted + margin,
    });
  }

  const totalForecast = forecastPeriods.reduce((sum, p) => sum + p.predictedDemand, 0);
  const daysUntilStockout = estimateStockout(currentStock, forecastPeriods);

  let reorderRecommended = false;
  let recommendedQuantity = 0;

  if (daysUntilStockout !== null && daysUntilStockout <= 14) {
    reorderRecommended = true;
    recommendedQuantity = Math.max(
      totalForecast - currentStock + Math.floor(totalForecast / 4),
      reorderLevel * 2 - currentStock,
    );
    recommendedQuantity = Math.max(recommendedQuantity, 0);
  } else if (currentStock < reorderLevel) {
    reorderRecommended = true;
    recommendedQuantity = Math.max(0, reorderLevel * 2 - currentStock);
  }

  const accuracyScore = calculateMAPE(consumptions);

  return {
    itemName,
    itemId,
    currentStock,
    forecastPeriods,
    totalForecast,
    daysUntilStockout,
    reorderRecommended,
    recommendedQuantity,
    method: 'weighted_moving_average',
    accuracyScore,
    reorderLevel,
  };
}

function calculateStdDev(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

function calculateMAPE(consumptions: number[]): number | null {
  const n = consumptions.length;
  if (n < 4) return null;

  const errors: number[] = [];
  for (let i = 3; i < n; i++) {
    const actual = consumptions[i];
    if (actual === 0) continue;
    const recent = consumptions.slice(i - 3, i);
    const wma = WMA_WEIGHTS.reduce((sum, w, j) => sum + w * recent[j], 0);
    if (wma > 0) {
      errors.push(Math.abs(actual - wma) / actual);
    }
  }

  if (errors.length === 0) return null;
  return Math.round((errors.reduce((a, b) => a + b, 0) / errors.length) * 10000) / 10000;
}

function estimateStockout(currentStock: number, forecastPeriods: ForecastPeriod[]): number | null {
  if (currentStock <= 0) return 0;

  let remaining = currentStock;
  for (const period of forecastPeriods) {
    remaining -= period.predictedDemand;
    if (remaining <= 0) {
      return (period.week - 1) * 7 + 4;
    }
  }

  return null;
}

/**
 * Build weekly consumption data from stock movements (for offline use).
 * Stock movements are cached locally from the API.
 */
export function buildWeeklyConsumption(
  movements: Array<{ movementDate: string; quantity: number; movementType: string }>,
  weeks: number = 12,
): WeeklyConsumption[] {
  const today = new Date();
  const result: WeeklyConsumption[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    const totalConsumed = movements
      .filter(m => {
        if (m.movementType !== 'CONSUMPTION') return false;
        const d = new Date(m.movementDate);
        return d >= weekStart && d <= weekEnd;
      })
      .reduce((sum, m) => sum + m.quantity, 0);

    result.push({
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      totalConsumed,
    });
  }

  return result;
}
