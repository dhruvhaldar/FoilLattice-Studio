import fs from 'node:fs';
import path from 'node:path';
import { generateXfoilFiles } from '../utils/fileGenerator.js';
import { parseXfoilPolar } from '../utils/parser.js';
import { demoProgress, readIfExists, spawnSolver, withWorkspace } from '../services/solverRunner.js';

export async function runXfoil(job, manager) {
  const { files, config } = generateXfoilFiles(job.input);
  const binary = manager.binaryPath('xfoil');
  return withWorkspace(files, async (cwd) => {
    if (fs.existsSync(binary)) {
      manager.emit(job, { type: 'log', stream: 'stdout', text: `Launching XFOIL in isolated workspace ${path.basename(cwd)}\n` });
      await spawnSolver({ binary, cwd, commands: files['commands.in'], job, manager });
      const polar = await readIfExists(path.join(cwd, 'polar.txt'));
      if (!polar) throw new Error('XFOIL completed without producing polar.txt');
      return { mode: 'native', solver: 'xfoil', points: parseXfoilPolar(polar), config };
    }
    if (process.env.ALLOW_DEMO === 'false') throw new Error(`XFOIL binary is not installed at ${binary}`);
    await demoProgress(job, manager, 'xfoil');
    const points = [];
    const code = Number(job.input.airfoil?.code || 12);
    const camber = Math.floor(code / 1000) / 100;
    for (let alpha = config.sweep.start; alpha <= config.sweep.end + config.sweep.step / 100; alpha += config.sweep.step) {
      const radians = alpha * Math.PI / 180;
      const clLinear = 2 * Math.PI * (radians + camber);
      const cl = clLinear / Math.sqrt(1 + Math.pow(Math.abs(clLinear) / 1.45, 8));
      const cd = 0.0075 + 0.009 * cl * cl + 30000 / Math.max(config.reynolds, 1) * 0.002;
      const point = { alpha: +alpha.toFixed(4), cl: +cl.toFixed(5), cd: +cd.toFixed(6), cdp: +(cd * 0.72).toFixed(6), cm: +(-0.025 - camber * 1.5).toFixed(5), topXtr: 0.7, botXtr: 0.8, ld: +(cl / cd).toFixed(2) };
      points.push(point);
      manager.emit(job, { type: 'log', stream: 'stdout', text: `alpha=${point.alpha.toFixed(2)}  CL=${point.cl.toFixed(4)}  CD=${point.cd.toFixed(5)}\n` });
    }
    return { mode: 'demo', solver: 'xfoil', points, config, warning: 'Preview values are illustrative and are not solver results.' };
  });
}
