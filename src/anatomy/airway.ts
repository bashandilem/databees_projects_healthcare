import { clamp, physiology } from '../model';
import type { Parameters } from '../model';

export const regions = {
  rightUpper: { label: 'Right upper lobe bronchus', short: 'R · upper lobe', sensitivity: 1 },
  rightMiddle: { label: 'Right middle lobe bronchus', short: 'R · middle lobe', sensitivity: 1 },
  rightLower: { label: 'Right lower lobe bronchus', short: 'R · lower lobe', sensitivity: 1 },
  leftUpper: { label: 'Left upper lobe bronchus', short: 'L · upper lobe', sensitivity: 1 },
  leftLower: { label: 'Left lower lobe bronchus', short: 'L · lower lobe', sensitivity: 1 },
  bronchiole: { label: 'Small bronchiole · magnified', short: 'Small bronchiole', sensitivity: 1.12 },
  trachea: { label: 'Trachea · cartilage-supported', short: 'Trachea', sensitivity: 0.08 },
} as const;
export type Region = keyof typeof regions;
export type Layer = 'outer' | 'muscle' | 'mucosa' | 'epithelium' | 'mucus';
export type LayerVisibility = Record<Layer, boolean>;
export const layerInfo: Record<Layer, { label: string; color: string; description: string }> = {
  outer: { label: 'Outer wall', color: '#927081', description: 'Connective tissue supports the airway.' },
  muscle: { label: 'Smooth muscle', color: '#a94f5a', description: 'Contracting muscle reduces airway circumference.' },
  mucosa: { label: 'Submucosa', color: '#ce827a', description: 'Inflammatory swelling thickens the tissue beneath the lining.' },
  epithelium: { label: 'Epithelium', color: '#dfaa8e', description: 'The folded inner lining surrounds the open lumen.' },
  mucus: { label: 'Mucus', color: '#b89b48', description: 'An uneven mucus film fills the lumen from the inside.' },
};
export const allLayers: LayerVisibility = { outer: true, muscle: true, mucosa: true, epithelium: true, mucus: true };

/** Shared geometry for the section, cutaway and endoscopic view. All radii are relative. */
export function airwayProfile(p: Parameters, region: Region = 'rightUpper') {
  const sensitivity = regions[region].sensitivity;
  const local = {
    ...p,
    constriction: clamp(p.constriction * sensitivity, 0, 80),
    inflammation: p.inflammation * (region === 'trachea' ? .35 : 1),
    activity: p.activity * sensitivity,
    allergen: p.allergen * sensitivity,
  };
  const metrics = physiology(local);
  const film = .0014 * p.mucus;
  const edema = .0018 * local.inflammation;
  const folds = .008 + .00024 * local.constriction;
  const lining = metrics.radius + film;
  const mucosa = lining + .075 + edema;
  const muscle = mucosa + .11 + .0016 * local.constriction;
  const outer = muscle + .09;
  const ripple = (theta: number, z = 0) => folds * Math.cos(theta * 12 + .15 * Math.sin(z * 3));
  const mucusThickness = (theta: number, z = 0) => film * (1 + .55 * Math.sin(theta * 3 + z * .6) + .24 * Math.cos(theta * 7 - z * 1.5));
  const epithelialRadius = (theta: number, z = 0) => lining + ripple(theta, z);
  const lumenRadius = (theta: number, z = 0) => Math.max(.065, epithelialRadius(theta, z) - mucusThickness(theta, z));
  let area = 0;
  for (let i = 0; i < 128; i++) area += lumenRadius(i / 128 * Math.PI * 2) ** 2 / 128;
  return { local, metrics, film, edema, lining, mucosa, muscle, outer, folds, epithelialRadius, lumenRadius, mucusThickness, area };
}
export type AirwayProfile = ReturnType<typeof airwayProfile>;
