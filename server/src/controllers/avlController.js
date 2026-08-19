import fs from 'node:fs';
import path from 'node:path';
import { generateAvlFiles } from '../utils/fileGenerator.js';
import { parseAvlStability, parseAvlStripForces } from '../utils/parser.js';
import { demoProgress, readIfExists, spawnSolver, withWorkspace } from '../services/solverRunner.js';

export async function runAvl(job, manager) {
  const { files, config } = generateAvlFiles(job.input);
  const binary = manager.binaryPath('avl');
  return withWorkspace(files, async (cwd) => {
    if (fs.existsSync(binary)) {
      manager.emit(job, { type: 'log', stream: 'stdout', text: `Launching AVL in isolated workspace ${path.basename(cwd)}\n` });
      await spawnSolver({ binary, cwd, commands: files['commands.in'], job, manager });
      const points = [];
      for (let i = 0; i < config.pointCount; i += 1) {
        const stability = await readIfExists(path.join(cwd, `st_${i}.txt`));
        const forces = await readIfExists(path.join(cwd, `fs_${i}.txt`));
        if (stability) points.push({ ...parseAvlStability(stability), strips: forces ? parseAvlStripForces(forces) : [] });
      }
      return { mode: 'native', solver: 'avl', points, config };
    }
    if (process.env.ALLOW_DEMO === 'false') throw new Error(`AVL binary is not installed at ${binary}`);
    await demoProgress(job, manager, 'avl');
    const aspectRatio = config.references.bref ** 2 / config.references.sref;
    const efficiency = 0.82;
    const slope = 2 * Math.PI * aspectRatio / (aspectRatio + 2);
    const points = [];
    for (let alpha = config.sweep.start; alpha <= config.sweep.end + config.sweep.step / 100; alpha += config.sweep.step) {
      const cl = slope * alpha * Math.PI / 180;
      const cd = 0.012 + cl * cl / (Math.PI * aspectRatio * efficiency);
      const point = { alpha: +alpha.toFixed(4), cl: +cl.toFixed(5), cd: +cd.toFixed(6), cm: +(-0.035 - 0.045 * cl).toFixed(5), neutralPoint: +(config.references.cref * 0.28).toFixed(4), derivatives: { CLa: +slope.toFixed(5), Cma: -0.62, Cnb: 0.11 }, strips: [] };
      points.push(point);
      manager.emit(job, { type: 'log', stream: 'stdout', text: `OPER alpha=${point.alpha.toFixed(2)}  CLtot=${point.cl.toFixed(4)}  CDtot=${point.cd.toFixed(5)}  Cmtot=${point.cm.toFixed(4)}\n` });
    }
    return { mode: 'demo', solver: 'avl', points, config, warning: 'Preview values are illustrative and are not solver results.' };
  });
}
