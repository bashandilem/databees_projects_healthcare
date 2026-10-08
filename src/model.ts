export type Parameters = { constriction: number; inflammation: number; mucus: number; rate: number; activity: number; allergen: number };
export const scenarios: Record<string, Parameters> = {
  Healthy: { constriction: 5, inflammation: 5, mucus: 5, rate: 14, activity: 0, allergen: 0 },
  'Mild Asthma': { constriction: 25, inflammation: 30, mucus: 20, rate: 18, activity: 0, allergen: 1 },
  'Moderate Attack': { constriction: 45, inflammation: 55, mucus: 45, rate: 24, activity: 0, allergen: 2 },
  'Severe Attack': { constriction: 70, inflammation: 80, mucus: 70, rate: 32, activity: 0, allergen: 3 },
  'Post-Exercise Attack': { constriction: 50, inflammation: 50, mucus: 35, rate: 29, activity: 2, allergen: 1 },
};
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export function physiology(p: Parameters) {
  const burden = clamp(.68 * p.constriction + .18 * p.inflammation + .14 * p.mucus + p.activity * 2 + p.allergen * 1.5, 0, 90);
  const radius = clamp(1 - burden / 100, .15, 1);
  const resistance = clamp(1 / radius ** 4, 1, 24);
  const airflow = clamp(100 - (burden - 5) * 1.1, 0, 100);
  const spo2 = clamp(98 - Math.max(0, burden - 12) * .12 - Math.max(0, burden - 50) * .16, 80, 99);
  const rate = clamp(p.rate + Math.max(0, burden - 30) * .055 + p.activity, 8, 35);
  const severity = clamp(burden * 1.05 + Math.max(0, rate - 18) * .45, 0, 100);
  const lungFunction = clamp(100 - Math.max(0, burden - 5) * .95, 0, 100);
  const work = clamp(resistance * rate / 14, 1, 60);
  const label = severity < 18 ? 'NORMAL' : severity < 40 ? 'MILD ABNORMALITY' : severity < 65 ? 'MODERATE AIRWAY OBSTRUCTION' : 'HIGH-RISK RESPIRATORY PATTERN';
  const color = severity < 18 ? '#49dba8' : severity < 40 ? '#55c9ed' : severity < 65 ? '#f6b563' : '#ff707b';
  return { burden, radius, resistance, airflow, spo2, rate, severity, lungFunction, work, peakFlow: airflow * 4.8, label, color };
}
export type Metrics = ReturnType<typeof physiology>;
export const baseline = physiology(scenarios.Healthy);
export function interpolate(a: Parameters, b: Parameters, t: number): Parameters {
  return Object.fromEntries(Object.keys(a).map(k => [k, a[k as keyof Parameters] + (b[k as keyof Parameters] - a[k as keyof Parameters]) * t])) as Parameters;
}
export type Sample = { time: number; airflow: number; spo2: number; resistance: number };
