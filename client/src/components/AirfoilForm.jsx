import { Form, Row, Col, Card } from 'react-bootstrap';

const Field = ({ label, value, onChange, ...props }) => (
  <Form.Group className="mb-3">
    <Form.Label>{label}</Form.Label>
    <Form.Control value={value} onChange={(event) => onChange(event.target.value)} {...props} />
  </Form.Group>
);

export default function AirfoilForm({ value, onChange }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  const setSweep = (key, next) => set('sweep', { ...value.sweep, [key]: next });
  const setAirfoil = (key, next) => set('airfoil', { ...value.airfoil, [key]: next });
  const upload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const lines = String(reader.result).split(/\r?\n/);
      set('airfoil', { type: 'coordinates', name: lines[0] || file.name, coordinates: lines.slice(1).join('\n') });
    };
    reader.readAsText(file);
  };
  return (
    <div className="form-stack">
      <Card className="panel-card"><Card.Body>
        <div className="section-kicker">Geometry</div><h2>Airfoil source</h2>
        <div className="source-switch mb-3">
          <button className={value.airfoil.type !== 'coordinates' ? 'active' : ''} onClick={() => setAirfoil('type', 'naca')}><i className="fa-solid fa-wand-magic-sparkles" /> NACA</button>
          <button className={value.airfoil.type === 'coordinates' ? 'active' : ''} onClick={() => setAirfoil('type', 'coordinates')}><i className="fa-solid fa-file-arrow-up" /> Coordinate file</button>
        </div>
        {value.airfoil.type === 'coordinates' ? <Form.Group><Form.Label>Airfoil .dat file</Form.Label><Form.Control type="file" accept=".dat,.txt" onChange={(event) => upload(event.target.files[0])} /><div className="form-hint mt-2">{value.airfoil.name || 'No coordinate file selected'}</div></Form.Group> : <Field label="NACA designation" value={value.airfoil.code} onChange={(next) => setAirfoil('code', next)} inputMode="numeric" placeholder="2412" />}
      </Card.Body></Card>
      <Card className="panel-card"><Card.Body>
        <div className="section-kicker">Flow condition</div><h2>Operating point</h2>
        <Row><Col md={6}><Field label="Reynolds number" type="number" value={value.reynolds} onChange={(next) => set('reynolds', next)} min="0" /></Col><Col md={6}><Field label="Mach number" type="number" step="0.01" value={value.mach} onChange={(next) => set('mach', next)} min="0" max="0.95" /></Col></Row>
        <Field label="Iteration limit" type="number" value={value.iterations} onChange={(next) => set('iterations', next)} min="1" max="5000" />
      </Card.Body></Card>
      <Card className="panel-card"><Card.Body>
        <div className="section-kicker">Sequence</div><h2>Angle-of-attack sweep</h2>
        <Row><Col><Field label="Start (deg)" type="number" value={value.sweep.start} onChange={(next) => setSweep('start', next)} /></Col><Col><Field label="End (deg)" type="number" value={value.sweep.end} onChange={(next) => setSweep('end', next)} /></Col><Col><Field label="Step (deg)" type="number" value={value.sweep.step} onChange={(next) => setSweep('step', next)} min="0.01" /></Col></Row>
      </Card.Body></Card>
    </div>
  );
}
