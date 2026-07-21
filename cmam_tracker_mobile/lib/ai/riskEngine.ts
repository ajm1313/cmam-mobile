/**
 * Offline Risk Prediction Engine
 *
 * Mirrors the backend risk_engine.py logic for on-device prediction.
 * Uses the same weighted scoring model with CMAM risk factors.
 * Runs entirely offline using cached patient data.
 */

export interface RiskFactor {
  factor: string;
  score: number;
  weight: number;
  detail: string;
}

export interface RiskPrediction {
  riskScore: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  riskLabel: string;
  contributingFactors: RiskFactor[];
  recommendations: string[];
}

export interface RiskInput {
  ageMonths: number;
  malnutritionType: 'SAM' | 'MAM';
  admissionDate: string;
  status: string;
  medicalComplications: boolean;
  oedema: string | null;
  appetiteTest: string | null;
  travelTime: string | null;
  caregiverPhone: string | null;
  motherAlive: string | null;
  fatherAlive: string | null;
  visitCount: number;
  nextVisitDate: string | null;
  latestVisit?: {
    appetite: string | null;
    rutfTest: string | null;
    weightKg: number;
  } | null;
  previousVisit?: {
    weightKg: number;
  } | null;
}

const RISK_WEIGHTS = {
  missedVisits: 0.25,
  weightTrend: 0.20,
  travelDifficulty: 0.10,
  medicalComplications: 0.15,
  appetiteFailure: 0.10,
  youngAge: 0.05,
  treatmentDuration: 0.05,
  caregiverFactors: 0.05,
  visitAdherence: 0.05,
};

const RISK_LEVELS: [number, number, 'low' | 'moderate' | 'high' | 'critical', string][] = [
  [0.0, 0.25, 'low', 'Low Risk'],
  [0.25, 0.50, 'moderate', 'Moderate Risk'],
  [0.50, 0.75, 'high', 'High Risk'],
  [0.75, 1.01, 'critical', 'Critical Risk'],
];

function getRiskLevel(score: number): ['low' | 'moderate' | 'high' | 'critical', string] {
  for (const [low, high, code, label] of RISK_LEVELS) {
    if (score >= low && score < high) return [code, label];
  }
  return ['low', 'Low Risk'];
}

export function predictRisk(input: RiskInput): RiskPrediction {
  const factors: RiskFactor[] = [];
  const today = new Date();

  // 1. Missed visits / overdue
  let daysOverdue = 0;
  if (input.nextVisitDate) {
    const nextDate = new Date(input.nextVisitDate);
    const diff = today.getTime() - nextDate.getTime();
    daysOverdue = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }

  let missedScore = 0;
  if (daysOverdue > 21) missedScore = 1.0;
  else if (daysOverdue > 14) missedScore = 0.8;
  else if (daysOverdue > 7) missedScore = 0.6;
  else if (daysOverdue > 0) missedScore = 0.3;

  factors.push({
    factor: 'missed_visits',
    score: missedScore,
    weight: RISK_WEIGHTS.missedVisits,
    detail: `${daysOverdue} days overdue for next visit`,
  });

  // 2. Weight trend
  let weightScore = 0;
  let weightDetail = 'No visit data';
  if (input.latestVisit && input.previousVisit) {
    const change = input.latestVisit.weightKg - input.previousVisit.weightKg;
    if (change < 0) {
      weightScore = 1.0;
      weightDetail = `Weight loss: ${change.toFixed(2)}kg`;
    } else if (change === 0) {
      weightScore = 0.5;
      weightDetail = 'No weight gain';
    } else if (change < 0.2) {
      weightScore = 0.3;
      weightDetail = `Slow gain: +${change.toFixed(2)}kg`;
    } else {
      weightScore = 0.0;
      weightDetail = `Good gain: +${change.toFixed(2)}kg`;
    }
  } else if (input.visitCount === 1) {
    weightScore = 0.2;
    weightDetail = 'Single visit - insufficient trend data';
  }

  factors.push({
    factor: 'weight_trend',
    score: weightScore,
    weight: RISK_WEIGHTS.weightTrend,
    detail: weightDetail,
  });

  // 3. Travel difficulty
  let travelScore = 0;
  let travelDetail = 'Unknown';
  if (input.travelTime) {
    const hours = parseFloat(input.travelTime);
    if (!isNaN(hours)) {
      if (hours >= 3) { travelScore = 1.0; travelDetail = `Very long travel: ${input.travelTime}`; }
      else if (hours >= 2) { travelScore = 0.6; travelDetail = `Long travel: ${input.travelTime}`; }
      else if (hours >= 1) { travelScore = 0.3; travelDetail = `Moderate travel: ${input.travelTime}`; }
      else { travelScore = 0.0; travelDetail = `Short travel: ${input.travelTime}`; }
    } else if (input.travelTime.toLowerCase().includes('hour')) {
      travelScore = 0.5;
      travelDetail = `Travel: ${input.travelTime}`;
    }
  }

  factors.push({
    factor: 'travel_difficulty',
    score: travelScore,
    weight: RISK_WEIGHTS.travelDifficulty,
    detail: travelDetail,
  });

  // 4. Medical complications
  let medScore = 0;
  let medDetail = 'No complications';
  if (input.medicalComplications) {
    medScore = 1.0;
    medDetail = 'Has medical complications';
  }
  if (input.oedema && ['++', '+++'].includes(input.oedema)) {
    medScore = Math.max(medScore, 0.8);
    medDetail = `Severe oedema: ${input.oedema}`;
  }

  factors.push({
    factor: 'medical_complications',
    score: medScore,
    weight: RISK_WEIGHTS.medicalComplications,
    detail: medDetail,
  });

  // 5. Appetite failure
  let appetiteScore = 0;
  let appetiteDetail = 'Not tested';
  const appetite = (input.appetiteTest || '').toLowerCase();
  if (['fail', 'failed', 'poor'].includes(appetite)) {
    appetiteScore = 1.0;
    appetiteDetail = `Appetite test: ${input.appetiteTest}`;
  } else if (['pass', 'passed', 'good'].includes(appetite)) {
    appetiteScore = 0.0;
    appetiteDetail = `Appetite test: ${input.appetiteTest}`;
  }

  if (input.latestVisit) {
    if (input.latestVisit.appetite?.toLowerCase() === 'poor') {
      appetiteScore = Math.max(appetiteScore, 0.8);
      appetiteDetail = 'Poor appetite at latest visit';
    }
    if (input.latestVisit.rutfTest?.toLowerCase() === 'failed') {
      appetiteScore = Math.max(appetiteScore, 0.9);
      appetiteDetail = 'RUTF test failed at latest visit';
    }
  }

  factors.push({
    factor: 'appetite_failure',
    score: appetiteScore,
    weight: RISK_WEIGHTS.appetiteFailure,
    detail: appetiteDetail,
  });

  // 6. Young age
  let ageScore = 0;
  if (input.ageMonths < 6) ageScore = 1.0;
  else if (input.ageMonths < 12) ageScore = 0.4;

  factors.push({
    factor: 'young_age',
    score: ageScore,
    weight: RISK_WEIGHTS.youngAge,
    detail: `Age: ${input.ageMonths} months`,
  });

  // 7. Treatment duration
  let durationScore = 0;
  let durationDetail = 'New case';
  if (input.admissionDate) {
    const admDate = new Date(input.admissionDate);
    const daysInTreatment = Math.floor((today.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysInTreatment > 56 && input.status === 'Active') {
      durationScore = 0.8;
      durationDetail = `In treatment ${daysInTreatment} days without discharge`;
    } else if (daysInTreatment > 28) {
      durationScore = 0.4;
      durationDetail = `In treatment ${daysInTreatment} days`;
    } else {
      durationDetail = `In treatment ${daysInTreatment} days`;
    }
  }

  factors.push({
    factor: 'treatment_duration',
    score: durationScore,
    weight: RISK_WEIGHTS.treatmentDuration,
    detail: durationDetail,
  });

  // 8. Caregiver factors
  let caregiverScore = 0;
  let caregiverDetail = 'Caregiver present';
  if (input.motherAlive && ['no', 'deceased', 'dead'].includes(input.motherAlive.toLowerCase())) {
    caregiverScore = 0.8;
    caregiverDetail = 'Mother deceased';
  }
  if (input.fatherAlive && ['no', 'deceased', 'dead'].includes(input.fatherAlive.toLowerCase())) {
    caregiverScore = Math.max(caregiverScore, 0.6);
    caregiverDetail = 'Father deceased';
  }
  if (!input.caregiverPhone) {
    caregiverScore = Math.max(caregiverScore, 0.3);
    caregiverDetail += ', no phone contact';
  }

  factors.push({
    factor: 'caregiver_factors',
    score: caregiverScore,
    weight: RISK_WEIGHTS.caregiverFactors,
    detail: caregiverDetail,
  });

  // 9. Visit adherence
  let adherenceScore = 0;
  let adherenceDetail = 'No visits due yet';
  if (input.admissionDate) {
    const admDate = new Date(input.admissionDate);
    const weeksInTreatment = Math.max(1, Math.floor((today.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24 * 7)));
    let expectedVisits = weeksInTreatment;
    if (input.malnutritionType === 'MAM') expectedVisits = Math.max(1, Math.floor(weeksInTreatment / 2));

    if (input.visitCount > 0 && expectedVisits > 0) {
      const ratio = input.visitCount / expectedVisits;
      if (ratio < 0.3) { adherenceScore = 1.0; adherenceDetail = `${input.visitCount}/${expectedVisits} expected visits attended`; }
      else if (ratio < 0.5) { adherenceScore = 0.7; adherenceDetail = `${input.visitCount}/${expectedVisits} expected visits attended`; }
      else if (ratio < 0.8) { adherenceScore = 0.3; adherenceDetail = `${input.visitCount}/${expectedVisits} expected visits attended`; }
      else { adherenceScore = 0.0; adherenceDetail = `${input.visitCount}/${expectedVisits} expected visits attended`; }
    }
  }

  factors.push({
    factor: 'visit_adherence',
    score: adherenceScore,
    weight: RISK_WEIGHTS.visitAdherence,
    detail: adherenceDetail,
  });

  // Calculate weighted score
  const riskScore = Math.min(1, Math.max(0, factors.reduce((sum, f) => sum + f.score * f.weight, 0)));
  const [riskLevel, riskLabel] = getRiskLevel(riskScore);
  const recommendations = generateRecommendations(factors, riskLevel);

  return {
    riskScore: Math.round(riskScore * 10000) / 10000,
    riskLevel,
    riskLabel,
    contributingFactors: factors,
    recommendations,
  };
}

function generateRecommendations(factors: RiskFactor[], riskLevel: string): string[] {
  const recs: string[] = [];
  const highFactors = factors.filter(f => f.score >= 0.6);

  if (riskLevel === 'critical') {
    recs.push('URGENT: Conduct home visit immediately to locate patient');
    recs.push('Contact caregiver by phone to understand barriers');
    recs.push('Consider community volunteer follow-up');
  } else if (riskLevel === 'high') {
    recs.push('Schedule home visit within 3 days');
    recs.push('Call caregiver to remind next appointment');
    recs.push('Assess barriers to attendance (transport, finances)');
  }

  for (const f of highFactors) {
    if (f.factor === 'missed_visits') recs.push('Patient is significantly overdue - prioritize tracing');
    else if (f.factor === 'weight_trend') recs.push('Review treatment plan - consider IPC referral if not improving');
    else if (f.factor === 'medical_complications') recs.push('Refer for medical investigation of complications');
    else if (f.factor === 'appetite_failure') recs.push('Repeat appetite test; consider IPC admission if RUTF test fails');
    else if (f.factor === 'travel_difficulty') recs.push('Explore closer facility options or community-based delivery');
    else if (f.factor === 'caregiver_factors') recs.push('Engage alternative caregivers or community support');
  }

  if (riskLevel === 'moderate' || riskLevel === 'low') {
    recs.push('Continue routine follow-up and monitoring');
    recs.push('Reinforce caregiver education on treatment adherence');
  }

  if (recs.length === 0) recs.push('Continue standard CMAM protocol');
  return recs;
}
