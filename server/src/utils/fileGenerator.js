import { number, sweep, text, validation } from './validation.js';

const fixed = (value) => Number(value).toFixed(6);

export function generateXfoilFiles(input) {
  const reynolds = number(input.reynolds ?? 1e6, 'Reynolds number', { min: 0, max: 1e10 });
  const mach = number(input.mach ?? 0, 'Mach number', { min: 0, max: 0.95 });
  const iterations = number(input.iterations ?? 100, 'Iteration limit', { min: 1, max: 5000 });
  const range = sweep(input.sweep || { start: -4, end: 14, step: 1 });
  let geometryCommand;
  const files = {};
  if (input.airfoil?.type === 'coordinates') {
    if (!/^\s*[-+]?\d/.test(input.airfoil.coordinates || '')) throw validation('Custom airfoil coordinates are invalid');
    files['airfoil.dat'] = `${text(input.airfoil.name || 'Custom airfoil', 'Airfoil name')}\n${input.airfoil.coordinates.trim()}\n`;
    geometryCommand = 'LOAD airfoil.dat';
  } else {
    const code = String(input.airfoil?.code || '2412').trim();
    if (!/^\d{4,5}$/.test(code)) throw validation('NACA code must contain 4 or 5 digits');
    geometryCommand = `NACA ${code}`;
  }
  files['commands.in'] = [geometryCommand, 'PANE', 'OPER', `VISC ${fixed(reynolds)}`, `MACH ${fixed(mach)}`, `ITER ${Math.round(iterations)}`, 'PACC', 'polar.txt', '', `ASEQ ${fixed(range.start)} ${fixed(range.end)} ${fixed(range.step)}`, 'PACC', '', 'QUIT', ''].join('\n');
  return { files, config: { reynolds, mach, iterations, sweep: range } };
}

export function generateAvlFiles(input) {
  const refs = {
    sref: number(input.references?.sref ?? 10, 'Sref', { min: 0.001 }),
    cref: number(input.references?.cref ?? 1, 'Cref', { min: 0.001 }),
    bref: number(input.references?.bref ?? 10, 'Bref', { min: 0.001 })
  };
  const surfaces = input.surfaces;
  if (!Array.isArray(surfaces) || surfaces.length === 0) throw validation('At least one lifting surface is required');
  const lines = [text(input.name || 'Untitled aircraft', 'Aircraft name'), '0.0', '0 0 0.0', `${refs.sref} ${refs.cref} ${refs.bref}`, '0.0 0.0 0.0', '0.0'];
  for (const [index, surface] of surfaces.entries()) {
    const name = text(surface.name || `Surface ${index + 1}`, 'Surface name');
    const span = number(surface.span, `${name} span`, { min: 0.001 });
    const rootChord = number(surface.rootChord, `${name} root chord`, { min: 0.001 });
    const tipChord = number(surface.tipChord, `${name} tip chord`, { min: 0.001 });
    const sweepDeg = number(surface.sweep ?? 0, `${name} sweep`, { min: -75, max: 75 });
    const dihedralDeg = number(surface.dihedral ?? 0, `${name} dihedral`, { min: -45, max: 45 });
    const x = number(surface.x ?? 0, `${name} X location`);
    const z = number(surface.z ?? 0, `${name} Z location`);
    const yTip = span / 2;
    const xTip = x + yTip * Math.tan(sweepDeg * Math.PI / 180);
    const zTip = z + yTip * Math.tan(dihedralDeg * Math.PI / 180);
    lines.push('SURFACE', name, `${Math.round(surface.chordPanels || 12)} 1.0 ${Math.round(surface.spanPanels || 20)} 1.0`);
    if (surface.symmetric !== false) lines.push('YDUPLICATE', '0.0');
    lines.push('ANGLE', fixed(surface.incidence || 0), 'SECTION', `${fixed(x)} 0.0 ${fixed(z)} ${fixed(rootChord)} 0.0`);
    if (surface.airfoilCode) lines.push('NACA', String(surface.airfoilCode).replace(/\D/g, '').slice(0, 5));
    lines.push('SECTION', `${fixed(xTip)} ${fixed(yTip)} ${fixed(zTip)} ${fixed(tipChord)} 0.0`);
    if (surface.airfoilCode) lines.push('NACA', String(surface.airfoilCode).replace(/\D/g, '').slice(0, 5));
    if (surface.control?.name) lines.push('CONTROL', `${text(surface.control.name, 'Control name')} ${fixed(surface.control.gain ?? 1)} ${fixed(surface.control.hinge ?? 0.75)} 0 0 0 ${surface.control.duplicateSign ?? 1}`);
  }
  const files = {};
  for (const [index, body] of (input.bodies || []).entries()) {
    const name = text(body.name || `Body ${index + 1}`, 'Body name');
    const length = number(body.length, `${name} length`, { min: 0.001 });
    const diameter = number(body.diameter, `${name} diameter`, { min: 0.001 });
    const x = number(body.x ?? 0, `${name} X location`);
    const y = number(body.y ?? 0, `${name} Y location`);
    const z = number(body.z ?? 0, `${name} Z location`);
    const filename = `body_${index}.dat`;
    files[filename] = 'FoilLattice axisymmetric body\n0.00 0.00\n0.08 0.32\n0.20 0.47\n0.55 0.50\n0.82 0.38\n1.00 0.00\n';
    lines.push('BODY', name, '20 1.0', 'SCALE', `${fixed(length)} ${fixed(diameter / 2)} ${fixed(diameter / 2)}`, 'TRANSLATE', `${fixed(x)} ${fixed(y)} ${fixed(z)}`, 'BFILE', filename);
  }
  const range = sweep(input.sweep || { start: -4, end: 12, step: 2 });
  const commands = ['LOAD aircraft.avl', 'OPER'];
  let count = 0;
  for (let alpha = range.start; alpha <= range.end + range.step / 100; alpha += range.step) {
    commands.push('A', 'A', fixed(alpha), 'X', 'ST', `st_${count}.txt`, 'FS', `fs_${count}.txt`);
    count += 1;
  }
  commands.push('', 'QUIT', '');
  files['aircraft.avl'] = `${lines.join('\n')}\n`;
  files['commands.in'] = commands.join('\n');
  return { files, config: { references: refs, sweep: range, pointCount: count } };
}
