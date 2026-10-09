import { describe, expect, it } from 'vitest';
import { airwayProfile } from '../src/anatomy/airway';
import { scenarios } from '../src/model';
import { createBronchialTree } from '../src/anatomy/tree';

describe('layered airway anatomy', () => {
  it('mucus reduces open area while preserving the supporting wall', () => {
    const low = airwayProfile({ ...scenarios.Healthy, mucus: 0 });
    const high = airwayProfile({ ...scenarios.Healthy, mucus: 100 });
    expect(high.area).toBeLessThan(low.area * .8);
    expect(high.film).toBeGreaterThan(low.film);
    expect(high.outer).toBeCloseTo(low.outer, 6);
    expect(high.lining).toBeCloseTo(low.lining, 6);
  });
  it('inflammation adds submucosal thickness and contraction tightens the wall', () => {
    const healthy = airwayProfile(scenarios.Healthy);
    const inflamed = airwayProfile({ ...scenarios.Healthy, inflammation: 100 });
    const contracted = airwayProfile({ ...scenarios.Healthy, constriction: 80 });
    expect(inflamed.mucosa - inflamed.lining).toBeGreaterThan(healthy.mucosa - healthy.lining);
    expect(contracted.outer).toBeLessThan(healthy.outer);
    expect(contracted.area).toBeLessThan(healthy.area);
  });
  it('supports the trachea while bronchial lumens respond to bronchospasm', () => {
    const p = scenarios['Severe Attack'];
    expect(airwayProfile(p, 'trachea').area).toBeGreaterThan(airwayProfile(p, 'rightUpper').area * 3);
  });
  it('keeps all wall layers ordered and the lumen open under extreme inputs', () => {
    for (const constriction of [0, 40, 80]) for (const inflammation of [0, 50, 100]) for (const mucus of [0, 50, 100]) {
      const profile = airwayProfile({ constriction, inflammation, mucus, rate: 35, activity: 2, allergen: 3 });
      expect(profile.outer).toBeGreaterThan(profile.muscle);
      expect(profile.muscle).toBeGreaterThan(profile.mucosa);
      expect(profile.mucosa).toBeGreaterThan(profile.lining);
      for (let i = 0; i < 96; i++) {
        const t = i / 96 * Math.PI * 2;
        expect(profile.lumenRadius(t)).toBeGreaterThan(0);
        expect(profile.lumenRadius(t)).toBeLessThanOrEqual(profile.epithelialRadius(t));
      }
    }
  });
  it('contains nine airway generations and all five lobes with finite paths', () => {
    const tree = createBronchialTree();
    expect(tree).toHaveLength(1205);
    expect(new Set(tree.map(branch => branch.generation)).size).toBe(9);
    for (const region of ['rightUpper', 'rightMiddle', 'rightLower', 'leftUpper', 'leftLower']) expect(tree.some(branch => branch.region === region)).toBe(true);
    for (const branch of tree) {
      expect(branch.curve.getLength()).toBeGreaterThan(0);
      expect(branch.curve.getPoint(.5).toArray().every(Number.isFinite)).toBe(true);
    }
  });
});
