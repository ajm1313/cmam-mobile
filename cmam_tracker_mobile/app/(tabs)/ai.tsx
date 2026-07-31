import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, FlatList, TextInput,
  KeyboardAvoidingView, Platform, Keyboard, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
import { useNetworkStatus } from '../../lib/useNetworkStatus';
import { setCache, getCacheFallback } from '../../lib/cache';
import api from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { logger } from '../../lib/logger';
import OfflineBanner from '../../components/OfflineBanner';
import { Skeleton } from '../../components/LoadingSkeleton';
import {
  getAIOverview, getBatchRiskPredictions, getBatchStockForecasts,
  sendChatMessage,
  predictRiskOffline, forecastStockOffline, getOfflineResponse,
  type APIRiskData, type APIForecastData,
} from '../../lib/ai';

type AITab = 'overview' | 'risk' | 'forecast' | 'assistant';

export default function AIScreen() {
  const { colors } = useTheme();
  const { isConnected } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<AITab>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const tabs: { key: AITab; label: string; icon: string }[] = [
    { key: 'overview', label: 'Overview', icon: 'sparkles-outline' },
    { key: 'risk', label: 'Risk', icon: 'warning-outline' },
    { key: 'forecast', label: 'Forecast', icon: 'trending-up-outline' },
    { key: 'assistant', label: 'Assistant', icon: 'chatbubble-ellipses-outline' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <OfflineBanner />

      {/* Sub-tab selector */}
      <View style={[styles.subTabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabScroll}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              style={[
                styles.subTab,
                activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.key ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.subTabText,
                  { color: activeTab === tab.key ? colors.primary : colors.textMuted },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {activeTab === 'overview' && <OverviewTab colors={colors} isConnected={isConnected} />}
      {activeTab === 'risk' && <RiskTab colors={colors} isConnected={isConnected} />}
      {activeTab === 'forecast' && <ForecastTab colors={colors} isConnected={isConnected} />}
      {activeTab === 'assistant' && <AssistantTab colors={colors} isConnected={isConnected} />}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════

interface OverviewData {
  risk_summary: {
    total_assessed: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    top_risks: any[];
  };
  stock_summary: {
    total_items: number;
    reorder_recommended: number;
    stockout_within_2_weeks: number;
    critical_items: any[];
  };
}

function OverviewTab({ colors, isConnected }: { colors: any; isConnected: boolean }) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState<number | null>(null);
  const user = useAuthStore((s: any) => s.user);

  const createDraftRequest = useCallback(async (item: any) => {
    if (!isConnected) {
      Alert.alert('Offline', 'Draft requests can only be created when online.');
      return;
    }
    const qty = item.recommended_quantity || item.total_forecast || 0;
    if (!qty) {
      Alert.alert('No quantity', 'No recommended quantity for this item.');
      return;
    }
    setDraftSaving(item.item_id);
    try {
      await api.post('/v1/inventory/requests/create/', {
        requesting_facility_id: user?.location?.facility_id || null,
        priority: 'High',
        justification: 'Auto-generated from AI stock forecast',
        items: [{ item_id: item.item_id, quantity: qty, notes: 'Recommended by forecast' }],
      });
      Alert.alert('Success', `Draft stock request created for ${item.item_name}`);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create draft request');
    } finally {
      setDraftSaving(null);
    }
  }, [isConnected, user]);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const cached = await getCacheFallback<OverviewData>('ai_overview');
      if (cached) setData(cached.data);

      if (isConnected) {
        const resp = await getAIOverview();
        setData(resp.data);
        await setCache('ai_overview', resp.data, 5 * 60 * 1000);
      }
    } catch (e) {
      logger.error('[AI Overview] Error:', e);
      setError('Failed to load AI overview. Pull to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isConnected]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && !data) {
    return (
      <ScrollView style={styles.tabContainer}>
        <Skeleton height={120} style={{ margin: 12, borderRadius: 12 }} />
        <Skeleton height={120} style={{ margin: 12, borderRadius: 12 }} />
      </ScrollView>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No AI data available. {isConnected ? 'Pull to refresh.' : 'Connect to the internet to load.'}
        </Text>
      </View>
    );
  }

  const riskColors: Record<string, string> = {
    critical: colors.danger, high: colors.danger,
    moderate: colors.warning, low: colors.success,
  };

  return (
    <ScrollView
      style={styles.tabContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />}
    >
      {/* Risk Summary Card */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="warning-outline" size={20} color={colors.warning} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Default Risk Summary</Text>
        </View>
        <View style={styles.statsRow}>
          <StatBox label="Critical" value={data.risk_summary.critical} color={colors.danger} />
          <StatBox label="High" value={data.risk_summary.high} color={colors.danger} />
          <StatBox label="Moderate" value={data.risk_summary.moderate} color={colors.warning} />
          <StatBox label="Low" value={data.risk_summary.low} color={colors.success} />
        </View>
        <Text style={[styles.cardFooter, { color: colors.textSecondary }]}>
          {data.risk_summary.total_assessed} active cases assessed
        </Text>
      </View>

      {/* Top Risk Cases */}
      {data.risk_summary.top_risks.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Top Risk Cases</Text>
          {data.risk_summary.top_risks.slice(0, 5).map((r: any, i: number) => (
            <View key={i} style={[styles.riskRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.riskName, { color: colors.textPrimary }]}>{r.child_name}</Text>
                <Text style={[styles.riskDetail, { color: colors.textSecondary }]}>
                  {r.facility_name} · {r.malnutrition_type}
                </Text>
              </View>
              <View style={[styles.riskBadge, { backgroundColor: (riskColors[r.risk_level] || colors.success) + '20' }]}>
                <Text style={[styles.riskBadgeText, { color: riskColors[r.risk_level] || colors.success }]}>
                  {(r.risk_score * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Stock Summary Card */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="trending-up-outline" size={20} color={colors.info} />
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Stock Forecast Summary</Text>
        </View>
        <View style={styles.statsRow}>
          <StatBox label="Total Items" value={data.stock_summary.total_items} color={colors.primary} />
          <StatBox label="Reorder" value={data.stock_summary.reorder_recommended} color={colors.warning} />
          <StatBox label="Stockout ≤2wk" value={data.stock_summary.stockout_within_2_weeks} color={colors.danger} />
        </View>
      </View>

      {/* Critical Stock Items */}
      {data.stock_summary.critical_items.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Critical Stock Items</Text>
          {data.stock_summary.critical_items.slice(0, 5).map((item: any, i: number) => (
            <View key={i} style={[styles.riskRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.riskName, { color: colors.textPrimary }]}>{item.item_name}</Text>
                <Text style={[styles.riskDetail, { color: colors.textSecondary }]}>
                  Stock: {item.current_stock} · {item.days_until_stockout != null
                    ? `${item.days_until_stockout} days to stockout`
                    : 'No stockout predicted'}
                </Text>
              </View>
              {item.reorder_recommended && (
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={[styles.riskBadge, { backgroundColor: colors.warning + '20' }]}>
                    <Text style={[styles.riskBadgeText, { color: colors.warning }]}>Reorder</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => createDraftRequest(item)}
                    disabled={draftSaving === item.item_id}
                    style={[styles.draftBtn, { backgroundColor: colors.primary + '15' }]}
                  >
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                      {draftSaving === item.item_id ? '...' : 'Draft Request'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// RISK PREDICTION TAB
// ═══════════════════════════════════════════════════════════════════════════

function RiskTab({ colors, isConnected }: { colors: any; isConnected: boolean }) {
  const [predictions, setPredictions] = useState<APIRiskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCase, setSelectedCase] = useState<APIRiskData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const cached = await getCacheFallback<APIRiskData[]>('ai_risk_batch');
      if (cached) setPredictions(cached.data);

      if (isConnected) {
        const resp = await getBatchRiskPredictions();
        setPredictions(resp.data);
        await setCache('ai_risk_batch', resp.data, 5 * 60 * 1000);
      }
    } catch (e) {
      logger.error('[AI Risk] Error:', e);
      setError('Failed to load risk predictions. Pull to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isConnected]);

  useEffect(() => { loadData(); }, [loadData]);

  const riskColors: Record<string, string> = {
    critical: colors.danger, high: colors.danger,
    moderate: colors.warning, low: colors.success,
  };

  if (loading && predictions.length === 0) {
    return (
      <ScrollView style={styles.tabContainer}>
        {[1, 2, 3].map(i => <Skeleton key={i} height={80} style={{ margin: 12, borderRadius: 10 }} />)}
      </ScrollView>
    );
  }

  if (error && predictions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
      </View>
    );
  }

  if (predictions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No active cases to assess. {isConnected ? '' : 'Connect to sync data.'}
        </Text>
      </View>
    );
  }

  if (selectedCase) {
    return (
      <ScrollView style={styles.tabContainer} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />
      }>
        <TouchableOpacity onPress={() => setSelectedCase(null)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back to list</Text>
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{selectedCase.child_name}</Text>
          <Text style={[styles.detailSub, { color: colors.textSecondary }]}>
            {selectedCase.registration_number} · {selectedCase.facility_name} · {selectedCase.malnutrition_type}
          </Text>

          <View style={[styles.riskScoreContainer, { backgroundColor: (riskColors[selectedCase.risk_level] || colors.success) + '15' }]}>
            <Text style={[styles.riskScoreLabel, { color: colors.textSecondary }]}>Risk Score</Text>
            <Text style={[styles.riskScoreValue, { color: riskColors[selectedCase.risk_level] || colors.success }]}>
              {(selectedCase.risk_score * 100).toFixed(1)}%
            </Text>
            <Text style={[styles.riskScoreLevel, { color: riskColors[selectedCase.risk_level] || colors.success }]}>
              {selectedCase.risk_label}
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contributing Factors</Text>
          {selectedCase.contributing_factors.map((f, i) => (
            <View key={i} style={[styles.factorRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.factorName, { color: colors.textPrimary }]}>
                  {f.factor.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </Text>
                <Text style={[styles.factorDetail, { color: colors.textSecondary }]}>{f.detail}</Text>
              </View>
              <View style={[styles.factorScore, { backgroundColor: (f.score >= 0.6 ? colors.danger : f.score >= 0.3 ? colors.warning : colors.success) + '20' }]}>
                <Text style={[styles.factorScoreText, { color: f.score >= 0.6 ? colors.danger : f.score >= 0.3 ? colors.warning : colors.success }]}>
                  {(f.score * 100).toFixed(0)}%
                </Text>
              </View>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recommendations</Text>
          {selectedCase.recommendations.map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[styles.recText, { color: colors.textPrimary }]}>{rec}</Text>
            </View>
          ))}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={styles.tabContainer}
      data={predictions}
      keyExtractor={(item) => String(item.registration_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={() => setSelectedCase(item)}
        >
          <View style={styles.riskRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.riskName, { color: colors.textPrimary }]}>{item.child_name}</Text>
              <Text style={[styles.riskDetail, { color: colors.textSecondary }]}>
                {item.registration_number} · {item.facility_name} · {item.malnutrition_type}
              </Text>
            </View>
            <View style={[styles.riskBadge, { backgroundColor: (riskColors[item.risk_level] || colors.success) + '20' }]}>
              <Text style={[styles.riskBadgeText, { color: riskColors[item.risk_level] || colors.success }]}>
                {(item.risk_score * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      contentContainerStyle={{ padding: 12 }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCK FORECAST TAB
// ═══════════════════════════════════════════════════════════════════════════

function ForecastTab({ colors, isConnected }: { colors: any; isConnected: boolean }) {
  const [forecasts, setForecasts] = useState<APIForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<APIForecastData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const cached = await getCacheFallback<APIForecastData[]>('ai_forecast_batch');
      if (cached) setForecasts(cached.data);

      if (isConnected) {
        const resp = await getBatchStockForecasts();
        setForecasts(resp.data);
        await setCache('ai_forecast_batch', resp.data, 5 * 60 * 1000);
      }
    } catch (e) {
      logger.error('[AI Forecast] Error:', e);
      setError('Failed to load stock forecasts. Pull to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isConnected]);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading && forecasts.length === 0) {
    return (
      <ScrollView style={styles.tabContainer}>
        {[1, 2, 3].map(i => <Skeleton key={i} height={80} style={{ margin: 12, borderRadius: 10 }} />)}
      </ScrollView>
    );
  }

  if (error && forecasts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
        <Text style={[styles.emptyText, { color: colors.danger }]}>{error}</Text>
      </View>
    );
  }

  if (forecasts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          No inventory data for forecasting. {isConnected ? '' : 'Connect to sync data.'}
        </Text>
      </View>
    );
  }

  if (selectedItem) {
    return (
      <ScrollView style={styles.tabContainer} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />
      }>
        <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}>Back to list</Text>
        </TouchableOpacity>

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.detailTitle, { color: colors.textPrimary }]}>{selectedItem.item_name}</Text>

          <View style={styles.statsRow}>
            <StatBox label="Current Stock" value={selectedItem.current_stock} color={colors.primary} />
            <StatBox label="8-wk Forecast" value={selectedItem.total_forecast} color={colors.info} />
            <StatBox label="Reorder Level" value={selectedItem.reorder_level} color={colors.warning} />
          </View>

          {selectedItem.days_until_stockout !== null && (
            <View style={[styles.alertBox, {
              backgroundColor: selectedItem.days_until_stockout <= 7 ? colors.danger + '15' : colors.warning + '15',
              borderColor: selectedItem.days_until_stockout <= 7 ? colors.danger + '40' : colors.warning + '40',
            }]}>
              <Ionicons
                name={selectedItem.days_until_stockout <= 7 ? 'alert-circle' : 'time-outline'}
                size={20}
                color={selectedItem.days_until_stockout <= 7 ? colors.danger : colors.warning}
              />
              <Text style={[styles.alertText, { color: selectedItem.days_until_stockout <= 7 ? colors.danger : colors.warning }]}>
                Stockout in ~{selectedItem.days_until_stockout} days
              </Text>
            </View>
          )}

          {selectedItem.reorder_recommended && (
            <View style={[styles.alertBox, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '40' }]}>
              <Ionicons name="cart-outline" size={20} color={colors.warning} />
              <Text style={[styles.alertText, { color: colors.warning }]}>
                Reorder recommended: {selectedItem.recommended_quantity} units
              </Text>
            </View>
          )}

          {selectedItem.message && (
            <Text style={[styles.forecastMessage, { color: colors.textSecondary }]}>{selectedItem.message}</Text>
          )}

          {selectedItem.forecast_periods.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Weekly Forecast</Text>
              {selectedItem.forecast_periods.map((p, i) => (
                <View key={i} style={[styles.factorRow, { borderBottomColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.factorName, { color: colors.textPrimary }]}>Week {p.week}</Text>
                    <Text style={[styles.factorDetail, { color: colors.textSecondary }]}>
                      {p.week_start} to {p.week_end}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={[styles.forecastValue, { color: colors.textPrimary }]}>{p.predicted_demand}</Text>
                    <Text style={[styles.forecastRange, { color: colors.textMuted }]}>
                      {p.lower_bound}–{p.upper_bound}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {selectedItem.accuracy_score !== null && (
            <Text style={[styles.accuracyText, { color: colors.textSecondary }]}>
              Forecast accuracy (MAPE): {(selectedItem.accuracy_score * 100).toFixed(1)}% · Method: {selectedItem.method}
            </Text>
          )}
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    );
  }

  return (
    <FlatList
      style={styles.tabContainer}
      data={forecasts}
      keyExtractor={(item) => String(item.item_id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} colors={[colors.primary]} />}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface }]}
          onPress={() => setSelectedItem(item)}
        >
          <View style={styles.riskRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.riskName, { color: colors.textPrimary }]}>{item.item_name}</Text>
              <Text style={[styles.riskDetail, { color: colors.textSecondary }]}>
                Stock: {item.current_stock} · Forecast: {item.total_forecast} units (8wk)
              </Text>
              {item.days_until_stockout !== null && (
                <Text style={[styles.riskDetail, { color: item.days_until_stockout <= 7 ? colors.danger : colors.warning }]}>
                  Stockout in ~{item.days_until_stockout} days
                </Text>
              )}
            </View>
            {item.reorder_recommended && (
              <View style={[styles.riskBadge, { backgroundColor: colors.warning + '20' }]}>
                <Text style={[styles.riskBadgeText, { color: colors.warning }]}>Reorder</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      contentContainerStyle={{ padding: 12 }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CLINICAL ASSISTANT TAB
// ═══════════════════════════════════════════════════════════════════════════

interface LocalChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  source?: 'llm' | 'fallback' | 'offline';
}

function AssistantTab({ colors, isConnected }: { colors: any; isConnected: boolean }) {
  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<number | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    // Welcome message
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your CMAM clinical assistant. I can help with malnutrition diagnosis, RUTF dosage, IPC referral criteria, discharge protocols, and more. Ask me anything about CMAM management.',
      source: 'offline',
    }]);
  }, []);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const userMsg: LocalChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);
    Keyboard.dismiss();

    try {
      if (isConnected) {
        const resp = await sendChatMessage(text, sessionId);
        if (resp.success) {
          setSessionId(resp.data.session_id);
          setMessages(prev => [...prev, {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: resp.data.response,
            source: resp.data.source,
          }]);
        }
      } else {
        // Offline fallback
        const response = getOfflineResponse(text);
        setMessages(prev => [...prev, {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: response,
          source: 'offline',
        }]);
      }
    } catch (e) {
      // Fallback on error
      const response = getOfflineResponse(text);
      setMessages(prev => [...prev, {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: 'Connection error. ' + response,
        source: 'offline',
      }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, sending, isConnected, sessionId]);

  const quickPrompts = [
    'What are SAM diagnostic criteria?',
    'RUTF dosage for a 7kg child?',
    'When to refer to IPC?',
    'Discharge criteria for SAM?',
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.chatContainer}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.chatBubble,
              msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant,
              msg.role === 'user'
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[
              styles.chatText,
              { color: msg.role === 'user' ? '#fff' : colors.textPrimary },
            ]}>
              {msg.content}
            </Text>
            {msg.source && msg.role === 'assistant' && (
              <View style={styles.sourceTag}>
                <Text style={[styles.sourceText, { color: colors.textMuted }]}>
                  {msg.source === 'llm' ? '🤖 AI' : msg.source === 'fallback' ? '📋 Built-in KB' : '📱 Offline KB'}
                </Text>
              </View>
            )}
          </View>
        ))}

        {sending && (
          <View style={[styles.chatBubble, styles.chatBubbleAssistant, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}

        {/* Quick prompts */}
        {messages.length <= 1 && (
          <View style={styles.quickPrompts}>
            <Text style={[styles.quickPromptsTitle, { color: colors.textSecondary }]}>Quick questions:</Text>
            {quickPrompts.map((q, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.quickPrompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => sendMessage(q)}
              >
                <Text style={[styles.quickPromptText, { color: colors.primary }]}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.inputBar, {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, 8),
      }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about CMAM protocols..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          editable={!sending}
        />
        <TouchableOpacity
          onPress={() => sendMessage()}
          disabled={!input.trim() || sending}
          style={[styles.sendButton, { backgroundColor: (!input.trim() || sending) ? colors.border : colors.primary }]}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1 },
  subTabBar: { borderBottomWidth: 1 },
  subTabScroll: { paddingHorizontal: 8 },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  subTabText: { fontSize: 13, fontWeight: '600' },
  tabContainer: { flex: 1 },
  card: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 12,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardFooter: { fontSize: 12, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  statValue: { fontSize: 24, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  riskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  riskName: { fontSize: 14, fontWeight: '600' },
  riskDetail: { fontSize: 12, marginTop: 2 },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  riskBadgeText: { fontSize: 13, fontWeight: '700' },
  draftBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 12 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  backText: { fontSize: 14, fontWeight: '600' },
  detailTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  detailSub: { fontSize: 13, marginBottom: 12 },
  riskScoreContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  riskScoreLabel: { fontSize: 12, fontWeight: '600' },
  riskScoreValue: { fontSize: 36, fontWeight: '800', marginTop: 4 },
  riskScoreLevel: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  factorName: { fontSize: 13, fontWeight: '600' },
  factorDetail: { fontSize: 12, marginTop: 2 },
  factorScore: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  factorScoreText: { fontSize: 12, fontWeight: '700' },
  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  recText: { fontSize: 13, flex: 1, lineHeight: 18 },
  alertBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 12,
  },
  alertText: { fontSize: 13, fontWeight: '600', flex: 1 },
  forecastMessage: { fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  forecastValue: { fontSize: 18, fontWeight: '700' },
  forecastRange: { fontSize: 10, marginTop: 2 },
  accuracyText: { fontSize: 11, marginTop: 12, fontStyle: 'italic' },
  // Chat styles
  chatContainer: { flex: 1 },
  chatBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginBottom: 8,
  },
  chatBubbleUser: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  chatBubbleAssistant: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 0.5 },
  chatText: { fontSize: 14, lineHeight: 20 },
  sourceTag: { marginTop: 6 },
  sourceText: { fontSize: 10, fontWeight: '600' },
  quickPrompts: { marginTop: 16 },
  quickPromptsTitle: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  quickPrompt: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  quickPromptText: { fontSize: 13, fontWeight: '500' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
