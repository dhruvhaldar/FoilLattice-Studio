import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Modal, ProgressBar } from 'react-bootstrap';
import { solverApi } from '../services/solvers.js';

export default function SolverSetupDialog({ show, status, onChanged, onDismiss }) {
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!show) return undefined;
    return solverApi.onProgress((event) => setProgress(event));
  }, [show]);

  const perform = async (solver, action) => {
    setBusy(solver); setError(''); setProgress({ solver, phase: 'starting', percent: 0 });
    try {
      const result = action === 'download' ? await solverApi.download(solver) : await solverApi.provide(solver);
      if (result?.canceled) return;
      const nextStatus = result?.status || result;
      if (nextStatus?.solvers) onChanged(nextStatus);
    } catch (failure) { setError(failure.message || String(failure)); }
    finally { setBusy(null); setProgress(null); }
  };

  const solvers = status?.solvers ? Object.values(status.solvers) : [];
  const phaseLabel = { starting: 'Preparing download…', download: 'Downloading official binary…', verify: 'Verifying checksum…', complete: 'Installed' };

  return <Modal show={show} onHide={onDismiss} backdrop="static" centered size="lg" contentClassName="solver-modal">
    <Modal.Header><div><div className="section-kicker">EXECUTION ENGINE</div><Modal.Title>Set up aerodynamic solvers</Modal.Title><p>Solver binaries are stored separately from the application, so they can be installed or upgraded without changing the frontend.</p></div></Modal.Header>
    <Modal.Body>
      {error && <Alert variant="danger"><i className="fa-solid fa-triangle-exclamation" /> {error}</Alert>}
      <div className="solver-list">
        {solvers.map((item) => <section className="solver-item" key={item.id}>
          <div className="solver-icon"><i className={item.id === 'avl' ? 'fa-solid fa-plane' : 'fa-solid fa-wave-square'} /></div>
          <div className="solver-details"><div className="solver-name"><strong>{item.name}</strong>{item.installed ? <Badge bg={item.updateAvailable ? 'warning' : 'success'}>{item.updateAvailable ? 'Update available' : `Installed ${item.installedVersion}`}</Badge> : <Badge bg="secondary">Not installed</Badge>}</div><p>{item.description}</p><small>{item.requiresManualBuild ? 'Automatic binary download is unavailable for this platform. Compile the linked source or choose your executable.' : `Latest supported version: ${item.latestVersion}`}</small>
            {busy === item.id && progress?.solver === item.id && <div className="solver-progress"><span>{phaseLabel[progress.phase] || progress.message || progress.phase}</span><ProgressBar animated={progress.phase === 'download'} now={progress.percent ?? 10} /></div>}
          </div>
          <div className="solver-actions">
            {item.canDownload && <Button disabled={Boolean(busy)} onClick={() => perform(item.id, 'download')}><i className="fa-solid fa-download" /> {item.installed ? 'Download update' : 'Download official'}</Button>}
            <Button variant="outline-light" disabled={Boolean(busy)} onClick={() => perform(item.id, 'provide')}><i className="fa-regular fa-folder-open" /> Choose executable</Button>
            {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source package <i className="fa-solid fa-arrow-up-right-from-square" /></a>}
          </div>
        </section>)}
      </div>
      <div className="solver-location"><i className="fa-solid fa-shield-halved" /><span><strong>Verified and isolated</strong>Official downloads are checked against pinned SHA-256 hashes and written to {status?.runtime === 'web' ? 'the execution engine’s solver directory' : 'the app data directory'}.</span></div>
    </Modal.Body>
    <Modal.Footer>{solverApi.canOpenFolder && <Button variant="link" onClick={() => solverApi.openFolder()}><i className="fa-regular fa-folder-open" /> Open solver folder</Button>}<Button variant="outline-light" onClick={onDismiss}>Not now</Button></Modal.Footer>
  </Modal>;
}
