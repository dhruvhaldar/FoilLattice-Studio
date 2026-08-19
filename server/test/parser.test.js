import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAvlStability, parseAvlStripForces, parseXfoilPolar } from '../src/utils/parser.js';

test('parses XFOIL polar rows and computes efficiency', () => {
  const points = parseXfoilPolar(' alpha CL CD CDp CM Top_Xtr Bot_Xtr\n -2.000 -0.20 0.0100 0.0060 -0.03 0.8 0.7\n 0.000 0.10 0.0080 0.0050 -0.04 0.7 0.6');
  assert.equal(points.length, 2);
  assert.equal(points[1].cl, 0.1);
  assert.equal(points[1].ld, 12.5);
});

test('parses AVL totals, derivatives, and Fortran D notation', () => {
  const parsed = parseAvlStability(' Alpha = 2.000 CLtot = 0.331 CDtot = 1.20D-02 Cmtot = -0.042\n CLa = 5.82 Cma = -0.61 Xnp = 0.31');
  assert.equal(parsed.alpha, 2);
  assert.equal(parsed.cd, 0.012);
  assert.equal(parsed.derivatives.CLa, 5.82);
});

test('parses AVL strip table data', () => {
  const strips = parseAvlStripForces(' 1 0.25 1.2 0.3 0 0 0 0.43\n 2 0.50 1.1 0.28 0 0 0 0.39');
  assert.deepEqual(strips.map((strip) => strip.cl), [0.43, 0.39]);
});
