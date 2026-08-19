import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAvlFiles, generateXfoilFiles } from '../src/utils/fileGenerator.js';

test('generates a complete XFOIL command sequence', () => {
  const result = generateXfoilFiles({ airfoil: { type: 'naca', code: '2412' }, reynolds: 1e6, mach: 0.1, iterations: 100, sweep: { start: -2, end: 4, step: 1 } });
  assert.match(result.files['commands.in'], /NACA 2412/);
  assert.match(result.files['commands.in'], /ASEQ -2\.000000 4\.000000 1\.000000/);
  assert.equal(result.config.reynolds, 1e6);
});

test('generates mirrored AVL surface geometry and output commands', () => {
  const result = generateAvlFiles({ name: 'Test craft', references: { sref: 10, cref: 1, bref: 8 }, sweep: { start: 0, end: 4, step: 2 }, bodies: [{ name: 'Fuselage', length: 5, diameter: 0.7 }], surfaces: [{ name: 'Wing', span: 8, rootChord: 1.5, tipChord: 0.7, sweep: 10, dihedral: 3, symmetric: true, airfoilCode: '2412' }] });
  assert.match(result.files['aircraft.avl'], /SURFACE\nWing/);
  assert.match(result.files['aircraft.avl'], /YDUPLICATE/);
  assert.match(result.files['aircraft.avl'], /NACA\n2412/);
  assert.match(result.files['aircraft.avl'], /BODY\nFuselage/);
  assert.match(result.files['body_0.dat'], /1\.00 0\.00/);
  assert.equal(result.config.pointCount, 3);
});

test('rejects oversized sweeps', () => {
  assert.throws(() => generateXfoilFiles({ airfoil: { code: '0012' }, sweep: { start: -90, end: 90, step: 0.01 } }), /at most 401/);
});
