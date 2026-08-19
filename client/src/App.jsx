import { useEffect, useMemo, useState } from 'react';
import { Button, Dropdown, ProgressBar } from 'react-bootstrap';
import AirfoilForm from './components/AirfoilForm.jsx';
import AircraftBuilder from './components/AircraftBuilder.jsx';
import ResultsPlot from './components/ResultsPlot.jsx';
import RunTerminal from './components/RunTerminal.jsx';
import { cancelJob, health, startJob } from './services/api.js';

const defaultXfoil = { airfoil: { type: 'naca', code: '2412' }, reynolds: 1000000, mach: 0.08, iterations: 150, sweep: { start: -4, end: 14, step: 1 } };
const defaultAvl = { name: 'Concept aircraft', references: { sref: 12, cref: 1.25, bref: 10 }, sweep: { start: -4, end: 12, step: 2 }, bodies: [{ name: 'Fuselage', length: 6, diameter: 0.75, x: -0.8, y: 0, z: 0 }], surfaces: [
  { name: 'Main wing', span: 10, rootChord: 1.6, tipChord: 0.8, sweep: 12, dihedral: 3, incidence: 1, x: 0, z: 0, symmetric: true, airfoilCode: '2412', chordPanels: 12, spanPanels: 24 },
  { name: 'Horizontal tail', span: 4, rootChord: 0.9, tipChord: 0.5, sweep: 18, dihedral: 0, incidence: -1, x: 4, z: 0.2, symmetric: true, airfoilCode: '0012', chordPanels: 10, spanPanels: 16 }
] };

function loadProjects() { try { return JSON.parse(localStorage.getItem('foil-lattice-projects') || '[]'); } catch { return []; } }

export default function App() {
  const [solver, setSolver] = useState('xfoil');
  const [xfoil, setXfoil] = useState(defaultXfoil);
  const [avl, setAvl] = useState(defaultAvl);
  const [projects, setProjects] = useState(loadProjects);
  const [runs, setRuns] = useState([]);
  const [lines, setLines] = useState([]);
  const [job, setJob] = useState({ status: 'idle', progress: 0 });
  const [engine, setEngine] = useState(null);
  const [notice, setNotice] = useState('');
  const configuration = solver === 'xfoil' ? xfoil : avl;
  const projectName = solver === 'xfoil' ? `NACA ${xfoil.airfoil.code || xfoil.airfoil.name}` : avl.name;
  const solverInstalled = engine?.solvers?.[solver]?.installed;

  useEffect(() => { health().then(setEngine).catch(() => setEngine({ offline: true })); }, []);
  const solverSummary = useMemo(() => engine?.offline ? 'Engine offline' : solverInstalled ? 'Native solver ready' : 'Preview mode', [engine, solverInstalled]);

  const persist = (next) => { setProjects(next); localStorage.setItem('foil-lattice-projects', JSON.stringify(next)); };
  const saveProject = () => {
    const entry = { id: crypto.randomUUID(), name: projectName, solver, configuration, savedAt: new Date().toISOString() };
    persist([entry, ...projects].slice(0, 20));
    setNotice(`Saved “${entry.name}” locally`); setTimeout(() => setNotice(''), 2500);
  };
  const loadProject = (project) => { setSolver(project.solver); project.solver === 'xfoil' ? setXfoil(project.configuration) : setAvl(project.configuration); };

  const run = async () => {
    if (job.status === 'running') return;
    setLines([`$ Dispatching ${solver.toUpperCase()} analysis: ${projectName}\n`]);
    setJob({ status: 'running', progress: 1 });
    try {
      const started = await startJob(solver, configuration, (event, originalJob) => {
        if (event.type === 'log') setLines((current) => [...current, event.text]);
        if (event.type === 'status') setJob((current) => ({ ...current, id: originalJob.id, status: event.status, progress: event.progress ?? current.progress }));
        if (event.type === 'error') { setLines((current) => [...current, `ERROR: ${event.message}\n`]); setJob((current) => ({ ...current, status: 'failed' })); }
        if (event.type === 'result') setRuns((current) => [...current, { id: originalJob.id, name: `${projectName} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, result: event.result }]);
      });
      setJob((current) => ({ ...current, id: started.id }));
    } catch (error) { setLines((current) => [...current, `ERROR: ${error.message}\n`]); setJob({ status: 'failed', progress: 0 }); }
  };
  const cancel = async () => { if (job.id) await cancelJob(job.id); setJob((current) => ({ ...current, status: 'cancelled' })); };

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><i className="fa-solid fa-wind" /></div><div><strong>FoilLattice</strong><span>STUDIO</span></div></div>
      <div className="top-actions">
        <div className={`engine-pill ${engine?.offline ? 'offline' : ''}`}><span /><span>{solverSummary}</span></div>
        <Dropdown align="end"><Dropdown.Toggle variant="outline-light" className="project-menu"><i className="fa-regular fa-folder-open" /> Projects</Dropdown.Toggle><Dropdown.Menu className="saved-menu"><Dropdown.Header>Saved locally</Dropdown.Header>{projects.length ? projects.map((project) => <Dropdown.Item key={project.id} onClick={() => loadProject(project)}><strong>{project.name}</strong><small>{project.solver.toUpperCase()} · {new Date(project.savedAt).toLocaleDateString()}</small></Dropdown.Item>) : <Dropdown.ItemText>No saved projects</Dropdown.ItemText>}</Dropdown.Menu></Dropdown>
        <Button variant="outline-light" onClick={saveProject}><i className="fa-regular fa-floppy-disk" /> Save</Button>
      </div>
    </header>

    <nav className="solver-nav"><button className={solver === 'xfoil' ? 'active' : ''} onClick={() => setSolver('xfoil')}><span className="nav-icon"><i className="fa-solid fa-wave-square" /></span><span><strong>Airfoil analysis</strong><small>XFOIL polar sweep</small></span></button><button className={solver === 'avl' ? 'active' : ''} onClick={() => setSolver('avl')}><span className="nav-icon"><i className="fa-solid fa-plane" /></span><span><strong>Aircraft analysis</strong><small>AVL stability & loads</small></span></button></nav>

    <main>
      <section className="intro"><div><div className="eyebrow">{solver === 'xfoil' ? '2D VISCOUS ANALYSIS' : '3D VORTEX LATTICE'}</div><h1>{solver === 'xfoil' ? 'Shape the flow.' : 'Balance the aircraft.'}</h1><p>{solver === 'xfoil' ? 'Generate aerodynamic polars across an angle-of-attack sequence.' : 'Build lifting surfaces and evaluate forces, moments, and stability derivatives.'}</p></div><div className="case-tag"><span>ACTIVE CASE</span><strong>{projectName}</strong></div></section>
      <div className="workspace-grid">
        <section className="configuration-pane">{solver === 'xfoil' ? <AirfoilForm value={xfoil} onChange={setXfoil} /> : <AircraftBuilder value={avl} onChange={setAvl} />}</section>
        <section className="output-pane"><ResultsPlot runs={runs} onClear={() => setRuns([])} /><RunTerminal lines={lines} status={job.status} /></section>
      </div>
    </main>

    <div className="run-dock"><div className="run-meta"><span>{job.status === 'running' ? `Running ${solver.toUpperCase()}…` : 'Ready to analyze'}</span><small>{solverInstalled ? 'Results will be generated by the native solver.' : 'Native binary absent; results will use the clearly labeled preview model.'}</small>{job.status === 'running' && <ProgressBar now={job.progress} />}</div>{job.status === 'running' ? <Button className="cancel-button" onClick={cancel}><i className="fa-solid fa-stop" /> Cancel</Button> : <Button className="run-button" onClick={run} disabled={engine?.offline}><i className="fa-solid fa-play" /> Run analysis</Button>}</div>
    {notice && <div className="toast-note"><i className="fa-solid fa-check" /> {notice}</div>}
    <footer>FoilLattice Studio is free software licensed under <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer">GPLv3</a>. Solver trademarks belong to their respective authors.</footer>
  </div>;
}
