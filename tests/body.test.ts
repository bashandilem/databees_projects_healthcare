import { describe, expect, it } from 'vitest';
import { humanEnvelope } from '../src/anatomy/body';

describe('human anatomical envelope', () => {
  it('forms one closed surface with finite positions and usable normals', () => {
    const geometry = humanEnvelope();
    try {
      const position = geometry.getAttribute('position');
      const normal = geometry.getAttribute('normal');
      const indices = geometry.getIndex()!;
      expect(position.count).toBeGreaterThan(1000);
      expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
      expect(Array.from(normal.array).every(Number.isFinite)).toBe(true);
      const edges = new Map<string, number>();
      const connected = Array.from({ length: position.count }, () => new Set<number>());
      for (let i = 0; i < indices.count; i += 3) {
        const triangle = [indices.getX(i), indices.getX(i + 1), indices.getX(i + 2)];
        for (let j = 0; j < 3; j++) {
          const a = triangle[j], b = triangle[(j + 1) % 3];
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          edges.set(key, (edges.get(key) ?? 0) + 1);
          connected[a].add(b); connected[b].add(a);
        }
      }
      // A gap or a disconnected head/arm is visible when the body is rotated.
      expect([...edges.values()].every(count => count === 2)).toBe(true);
      const seen = new Set<number>([0]), pending = [0];
      while (pending.length) for (const next of connected[pending.pop()!]) {
        if (!seen.has(next)) { seen.add(next); pending.push(next); }
      }
      expect(seen.size).toBe(position.count);
      geometry.computeBoundingBox();
      expect(geometry.boundingBox!.min.y).toBeCloseTo(-5.05, 1);
      expect(geometry.boundingBox!.max.y).toBeGreaterThan(6.7);
    } finally { geometry.dispose(); }
  });
});
