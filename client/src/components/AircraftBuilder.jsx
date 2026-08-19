import { Button, Card, Col, Form, Row } from '../ui/primitives.jsx';

const Field = ({ label, value, onChange, ...props }) => <Form.Group className="mb-3"><Form.Label>{label}</Form.Label><Form.Control value={value} onChange={(event) => onChange(event.target.value)} {...props} /></Form.Group>;

function GeometryPreview({ surfaces }) {
  const maxSpan = Math.max(...surfaces.map((surface) => Number(surface.span) || 1));
  const polygons = surfaces.flatMap((surface, index) => {
    const half = (Number(surface.span) || 1) / maxSpan * 145;
    const root = (Number(surface.rootChord) || 1) * 25;
    const tip = (Number(surface.tipChord) || 1) * 25;
    const x = 120 + (Number(surface.x) || 0) * 20;
    const sweep = half * Math.tan((Number(surface.sweep) || 0) * Math.PI / 180);
    const right = `${x},150 ${x + root},150 ${x + sweep + tip},${150 - half} ${x + sweep},${150 - half}`;
    const left = `${x},150 ${x + root},150 ${x + sweep + tip},${150 + half} ${x + sweep},${150 + half}`;
    return [<polygon key={`${index}r`} points={right} />, surface.symmetric !== false && <polygon key={`${index}l`} points={left} />];
  });
  return <div className="geometry-preview"><div className="preview-label">PLANFORM PREVIEW</div><svg viewBox="0 0 360 300" role="img" aria-label="Aircraft planform preview"><line x1="0" y1="150" x2="360" y2="150" />{polygons}</svg></div>;
}

export default function AircraftBuilder({ value, onChange }) {
  const set = (key, next) => onChange({ ...value, [key]: next });
  const setRef = (key, next) => set('references', { ...value.references, [key]: next });
  const setSweep = (key, next) => set('sweep', { ...value.sweep, [key]: next });
  const updateSurface = (index, key, next) => set('surfaces', value.surfaces.map((surface, item) => item === index ? { ...surface, [key]: next } : surface));
  const addSurface = () => set('surfaces', [...value.surfaces, { name: `Surface ${value.surfaces.length + 1}`, span: 4, rootChord: 1, tipChord: 0.6, sweep: 10, dihedral: 0, x: 3, z: 0, incidence: 0, symmetric: true, airfoilCode: '0012', chordPanels: 10, spanPanels: 16 }]);
  const bodies = value.bodies || [];
  const updateBody = (index, key, next) => set('bodies', bodies.map((body, item) => item === index ? { ...body, [key]: next } : body));
  const addBody = () => set('bodies', [...bodies, { name: `Body ${bodies.length + 1}`, length: 5, diameter: 0.6, x: 0, y: 0, z: 0 }]);
  return <div className="form-stack">
    <Card className="panel-card"><Card.Body><div className="section-kicker">Aircraft</div><h2>Reference geometry</h2>
      <Field label="Configuration name" value={value.name} onChange={(next) => set('name', next)} />
      <Row><Col><Field label="Sref" type="number" value={value.references.sref} onChange={(next) => setRef('sref', next)} /></Col><Col><Field label="Cref" type="number" value={value.references.cref} onChange={(next) => setRef('cref', next)} /></Col><Col><Field label="Bref" type="number" value={value.references.bref} onChange={(next) => setRef('bref', next)} /></Col></Row>
      <GeometryPreview surfaces={value.surfaces} />
    </Card.Body></Card>
    {value.surfaces.map((surface, index) => <Card className="panel-card surface-card" key={index}><Card.Body>
      <div className="surface-heading"><div><div className="section-kicker">Surface {index + 1}</div><h2>{surface.name}</h2></div>{value.surfaces.length > 1 && <Button variant="link" className="remove-btn" onClick={() => set('surfaces', value.surfaces.filter((_, item) => item !== index))}><i className="fa-solid fa-trash" /></Button>}</div>
      <Field label="Name" value={surface.name} onChange={(next) => updateSurface(index, 'name', next)} />
      <Row><Col md={4}><Field label="Span" type="number" value={surface.span} onChange={(next) => updateSurface(index, 'span', next)} /></Col><Col md={4}><Field label="Root chord" type="number" value={surface.rootChord} onChange={(next) => updateSurface(index, 'rootChord', next)} /></Col><Col md={4}><Field label="Tip chord" type="number" value={surface.tipChord} onChange={(next) => updateSurface(index, 'tipChord', next)} /></Col></Row>
      <Row><Col><Field label="Sweep (deg)" type="number" value={surface.sweep} onChange={(next) => updateSurface(index, 'sweep', next)} /></Col><Col><Field label="Dihedral (deg)" type="number" value={surface.dihedral} onChange={(next) => updateSurface(index, 'dihedral', next)} /></Col><Col><Field label="Incidence (deg)" type="number" value={surface.incidence} onChange={(next) => updateSurface(index, 'incidence', next)} /></Col></Row>
      <Row><Col><Field label="X location" type="number" value={surface.x} onChange={(next) => updateSurface(index, 'x', next)} /></Col><Col><Field label="Z location" type="number" value={surface.z} onChange={(next) => updateSurface(index, 'z', next)} /></Col><Col><Field label="NACA airfoil" value={surface.airfoilCode} onChange={(next) => updateSurface(index, 'airfoilCode', next)} /></Col></Row>
      <Form.Check type="switch" label="Mirror across centerline" checked={surface.symmetric !== false} onChange={(event) => updateSurface(index, 'symmetric', event.target.checked)} />
    </Card.Body></Card>)}
    <Button className="add-surface" variant="outline-info" onClick={addSurface}><i className="fa-solid fa-plus" /> Add lifting surface</Button>
    {bodies.map((body, index) => <Card className="panel-card" key={`body-${index}`}><Card.Body>
      <div className="surface-heading"><div><div className="section-kicker">Body {index + 1}</div><h2>{body.name}</h2></div><Button variant="link" className="remove-btn" onClick={() => set('bodies', bodies.filter((_, item) => item !== index))}><i className="fa-solid fa-trash" /></Button></div>
      <Field label="Name" value={body.name} onChange={(next) => updateBody(index, 'name', next)} />
      <Row><Col><Field label="Length" type="number" value={body.length} onChange={(next) => updateBody(index, 'length', next)} /></Col><Col><Field label="Diameter" type="number" value={body.diameter} onChange={(next) => updateBody(index, 'diameter', next)} /></Col></Row>
      <Row><Col><Field label="X location" type="number" value={body.x} onChange={(next) => updateBody(index, 'x', next)} /></Col><Col><Field label="Y location" type="number" value={body.y} onChange={(next) => updateBody(index, 'y', next)} /></Col><Col><Field label="Z location" type="number" value={body.z} onChange={(next) => updateBody(index, 'z', next)} /></Col></Row>
      <div className="form-hint">Generated as a smooth axisymmetric AVL body profile.</div>
    </Card.Body></Card>)}
    <Button className="add-surface" variant="outline-info" onClick={addBody}><i className="fa-solid fa-plus" /> Add fuselage or nacelle</Button>
    <Card className="panel-card"><Card.Body><div className="section-kicker">Sequence</div><h2>Angle-of-attack sweep</h2><Row><Col><Field label="Start" type="number" value={value.sweep.start} onChange={(next) => setSweep('start', next)} /></Col><Col><Field label="End" type="number" value={value.sweep.end} onChange={(next) => setSweep('end', next)} /></Col><Col><Field label="Step" type="number" value={value.sweep.step} onChange={(next) => setSweep('step', next)} /></Col></Row></Card.Body></Card>
  </div>;
}
