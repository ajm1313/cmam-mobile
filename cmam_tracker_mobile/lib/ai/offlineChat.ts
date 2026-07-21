/**
 * Offline fallback knowledge base for the clinical assistant chatbot.
 * Used when the device is offline and cannot reach the server-side LLM.
 */

interface KnowledgeEntry {
  keywords: string[];
  response: string;
}

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    keywords: ['sam', 'severe', 'acute malnutrition', 'muac', '11.5'],
    response: `SAM (Severe Acute Malnutrition) is identified by:
- MUAC < 11.5 cm (6-59 months)
- WFH/WFL Z-score < -3SD
- Bilateral pitting oedema (Grade +, ++, +++)

Management:
- RUTF at 130-200 kcal/kg/day
- Weekly follow-up visits
- Amoxicillin at enrollment (if no complications)
- Vitamin A, Folic acid on Day 1
- Deworming at Week 2
- Measles vaccine at Week 4
- Discharge: MUAC >= 12.5cm for 2 visits, no oedema, weight gain
- IPC referral if appetite test fails or severe complications`,
  },
  {
    keywords: ['mam', 'moderate', '12.4', '12.0'],
    response: `MAM (Moderate Acute Malnutrition) is identified by:
- MUAC 11.5-12.4 cm (6-59 months)
- WFH/WFL Z-score < -2SD

Management:
- High-risk MAM: Treated like SAM (weekly visits, RUTF)
- Other MAM: Biweekly visits, supplementary food (RUSF/CSB+)
- Discharge: MUAC >= 12.5cm for 2 consecutive visits
- Refer to SAM if condition worsens`,
  },
  {
    keywords: ['rutf', 'dosage', 'ration', 'sachet'],
    response: `RUTF (Ready-to-Use Therapeutic Food) Dosage:
- SAM: 130-200 kcal/kg/day
- Typical: 2-3 sachets/day for 5-7kg child, 3-4 for 7-10kg
- High-risk MAM: Same as SAM
- Other MAM: Supplementary feeding (RUSF or CSB+)

Appetite test: Give RUTF at clinic, observe if child eats willingly.
Failed appetite test = IPC referral required.`,
  },
  {
    keywords: ['default', 'missed', 'absent', 'lost to follow'],
    response: `Defaulting in CMAM:
- Defined as 3 consecutive missed/absent visits
- After 1 missed visit: Call caregiver, remind next appointment
- After 2 missed visits: Schedule home visit
- After 3 missed visits: Mark as defaulted, active tracing
- Use community volunteers for tracing
- Readmission possible if child returns and still meets criteria`,
  },
  {
    keywords: ['oedema', 'edema', 'swelling'],
    response: `Oedema in CMAM:
- Grade +: Mild, both feet
- Grade ++: Moderate, feet + lower legs
- Grade +++: Severe, feet + legs + face

- Any bilateral pitting oedema = SAM regardless of MUAC
- Grade ++/+++ requires IPC admission
- Monitor oedema reduction at each visit
- Discharge requires no oedema for 2 consecutive visits`,
  },
  {
    keywords: ['discharge', 'cured', 'recovered', 'exit'],
    response: `Discharge Criteria (CMAM):

SAM Cured:
- MUAC >= 12.5 cm for 2 consecutive visits
- No oedema for 2 consecutive visits
- Weight gain confirmed
- Minimum 3 weeks in treatment

MAM Cured:
- MUAC >= 12.5 cm for 2 consecutive visits

Other exits: Death, Default (3 absences), Transfer, Non-response`,
  },
  {
    keywords: ['ipc', 'inpatient', 'referral', 'admit'],
    response: `IPC (Inpatient Therapeutic Care) Referral:

Refer to IPC when:
- Appetite test fails (child refuses RUTF)
- Severe medical complications (severe pneumonia, sepsis, severe dehydration)
- Grade ++/+++ oedema
- Weight loss despite treatment
- Severe anaemia, hypothermia, or lethargy

Transfer with referral form and treatment summary.`,
  },
  {
    keywords: ['visit', 'follow', 'schedule', 'when', 'next'],
    response: `Visit Schedule:
- SAM: Weekly visits (every 7 days)
- MAM: Biweekly visits (every 14 days)
- High-risk MAM: Weekly like SAM

At each visit:
- Measure weight, height, MUAC
- Check for oedema
- Appetite test (RUTF)
- Medical history (diarrhoea, vomiting, fever, cough)
- Physical examination
- Dispense RUTF/supplies
- Record treatment response`,
  },
  {
    keywords: ['appetite', 'test', 'rutf test'],
    response: `Appetite Test in CMAM:
- Offer RUTF to child at clinic
- Observe if child eats willingly within 30 minutes
- Passed: Child eats RUTF willingly
- Failed: Child refuses or cannot eat

Failed appetite test = IPC referral required
This is a critical decision point in CMAM protocol.`,
  },
  {
    keywords: ['weight', 'gain', 'loss', 'monitoring'],
    response: `Weight Monitoring in CMAM:
- Weigh at every visit (weekly for SAM, biweekly for MAM)
- Track weight change from previous visit
- Good response: > 0.2kg gain per week
- Poor response: No gain or weight loss
- Weight loss despite treatment = review treatment plan
- Consider IPC referral if weight loss persists

Discharge requires sustained weight gain.`,
  },
];

export function getOfflineResponse(message: string): string {
  const msgLower = message.toLowerCase();

  for (const entry of KNOWLEDGE_BASE) {
    for (const kw of entry.keywords) {
      if (msgLower.includes(kw)) {
        return entry.response;
      }
    }
  }

  return `I can help with CMAM clinical guidance. Try asking about:
- SAM or MAM diagnosis and management
- RUTF dosage and appetite testing
- IPC referral criteria
- Discharge criteria
- Visit schedules
- Oedema grading
- Managing defaulters
- Weight monitoring

Please describe the patient situation for specific advice.

Note: You are currently offline. Responses are from the built-in knowledge base. Connect to the internet for AI-powered responses.`;
}
