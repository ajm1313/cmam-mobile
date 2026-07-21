/**
 * AI API Client
 *
 * Handles communication with the backend AI endpoints.
 * Risk prediction and stock forecasting work offline via local engines,
 * with sync to backend when online. Chat requires online connectivity.
 */
import api from '../api';
import { predictRisk, type RiskInput, type RiskPrediction } from './riskEngine';
import { forecastStock, buildWeeklyConsumption, type StockForecastResult } from './forecastEngine';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface APIRiskData {
  registration_id: number;
  registration_number: string;
  child_name: string;
  facility_name: string;
  malnutrition_type: string;
  risk_score: number;
  risk_level: 'low' | 'moderate' | 'high' | 'critical';
  risk_label: string;
  contributing_factors: Array<{ factor: string; score: number; weight: number; detail: string }>;
  recommendations: string[];
}

export interface RiskPredictionResponse {
  success: boolean;
  data: APIRiskData;
}

export interface BatchRiskResponse {
  success: boolean;
  count: number;
  data: APIRiskData[];
}

export interface APIForecastData {
  item_name: string;
  item_id: number;
  item_code: string;
  item_category: string;
  current_stock: number;
  forecast_periods: Array<{
    week: number;
    week_start: string;
    week_end: string;
    predicted_demand: number;
    lower_bound: number;
    upper_bound: number;
  }>;
  total_forecast: number;
  days_until_stockout: number | null;
  reorder_recommended: boolean;
  recommended_quantity: number;
  method: string;
  accuracy_score: number | null;
  reorder_level: number;
  min_stock_level: number;
  message?: string;
}

export interface StockForecastResponse {
  success: boolean;
  data: APIForecastData;
}

export interface BatchForecastResponse {
  success: boolean;
  count: number;
  data: APIForecastData[];
}

export interface ChatSendResponse {
  success: boolean;
  data: {
    session_id: number;
    response: string;
    source: 'llm' | 'fallback';
    metadata: Record<string, unknown>;
  };
}

export interface ChatSession {
  id: number;
  title: string;
  is_active: boolean;
  message_count: number;
  last_message: string;
  last_message_time: string;
}

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

// ─── Risk Prediction API ────────────────────────────────────────────────────

export async function getRiskPrediction(registrationId: number): Promise<RiskPredictionResponse> {
  const { data } = await api.get(`/v1/ai/risk/${registrationId}/`);
  return data;
}

export async function getBatchRiskPredictions(facilityId?: number): Promise<BatchRiskResponse> {
  const params = facilityId ? { facility_id: facilityId } : {};
  const { data } = await api.get('/v1/ai/risk/', { params });
  return data;
}

export async function syncOfflineRiskPrediction(
  registrationId: number,
  prediction: RiskPrediction,
): Promise<{ success: boolean }> {
  const { data } = await api.post('/v1/ai/risk/offline/', {
    registration_id: registrationId,
    risk_score: prediction.riskScore,
    risk_level: prediction.riskLevel,
    contributing_factors: prediction.contributingFactors,
    recommendations: prediction.recommendations,
  });
  return data;
}

/**
 * Run offline risk prediction using local engine.
 * Uses cached patient data from AsyncStorage/SQLite.
 */
export function predictRiskOffline(input: RiskInput): RiskPrediction {
  return predictRisk(input);
}

// ─── Stock Forecast API ─────────────────────────────────────────────────────

export async function getStockForecast(itemId: number, facilityId?: number): Promise<StockForecastResponse> {
  const params = facilityId ? { facility_id: facilityId } : {};
  const { data } = await api.get(`/v1/ai/forecast/${itemId}/`, { params });
  return data;
}

export async function getBatchStockForecasts(facilityId?: number): Promise<BatchForecastResponse> {
  const params = facilityId ? { facility_id: facilityId } : {};
  const { data } = await api.get('/v1/ai/forecast/', { params });
  return data;
}

/**
 * Run offline stock forecast using local engine.
 * Uses cached stock movement data.
 */
export function forecastStockOffline(
  movements: Array<{ movementDate: string; quantity: number; movementType: string }>,
  currentStock: number,
  reorderLevel: number,
  itemName: string,
  itemId: number,
): StockForecastResult {
  const weeklyConsumption = buildWeeklyConsumption(movements);
  return forecastStock(weeklyConsumption, currentStock, reorderLevel, itemName, itemId);
}

export async function syncOfflineStockForecast(
  itemId: number,
  forecast: StockForecastResult,
  facilityId?: number,
): Promise<{ success: boolean }> {
  const { data } = await api.post('/v1/ai/forecast/offline/', {
    item_id: itemId,
    facility_id: facilityId,
    forecast_periods: forecast.forecastPeriods,
    method: forecast.method,
    accuracy_score: forecast.accuracyScore,
    current_stock: forecast.currentStock,
    days_until_stockout: forecast.daysUntilStockout,
    reorder_recommended: forecast.reorderRecommended,
    recommended_quantity: forecast.recommendedQuantity,
  });
  return data;
}

// ─── Clinical Assistant Chat API ────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  sessionId?: number,
): Promise<ChatSendResponse> {
  const { data } = await api.post('/v1/ai/chat/send/', {
    message,
    session_id: sessionId,
  });
  return data;
}

export async function getChatSessions(): Promise<{ success: boolean; data: ChatSession[] }> {
  const { data } = await api.get('/v1/ai/chat/sessions/');
  return data;
}

export async function getChatHistory(sessionId: number): Promise<{
  success: boolean;
  data: { session_id: number; title: string; messages: ChatMessage[] };
}> {
  const { data } = await api.get(`/v1/ai/chat/${sessionId}/`);
  return data;
}

export async function deleteChatSession(sessionId: number): Promise<{ success: boolean }> {
  const { data } = await api.delete(`/v1/ai/chat/${sessionId}/delete/`);
  return data;
}

// ─── AI Overview API ────────────────────────────────────────────────────────

export async function getAIOverview(facilityId?: number): Promise<{
  success: boolean;
  data: {
    risk_summary: {
      total_assessed: number;
      critical: number;
      high: number;
      moderate: number;
      low: number;
      top_risks: APIRiskData[];
    };
    stock_summary: {
      total_items: number;
      reorder_recommended: number;
      stockout_within_2_weeks: number;
      critical_items: APIForecastData[];
    };
  };
}> {
  const params = facilityId ? { facility_id: facilityId } : {};
  const { data } = await api.get('/v1/ai/overview/', { params });
  return data;
}
