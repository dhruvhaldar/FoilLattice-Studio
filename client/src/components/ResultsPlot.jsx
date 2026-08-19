import { useMemo, useState } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-basic-dist-min';
import { Button, Card, Table } from 'react-bootstrap';

const Plot = createPlotlyComponent(Plotly);
const colors = ['#48d8c5', '#ffba63', '#6ea8fe', '#d889ff', '#ff718b'];
const metrics = { clAlpha: { x: 'alpha', y: 'cl', xLabel: 'Angle of attack (deg)', yLabel: 'CL', title: 'Lift curve' }, dragPolar: { x: 'cd', y: 'cl', xLabel: 'CD', yLabel: 'CL', title: 'Drag polar' }, cmAlpha: { x: 'alpha', y: 'cm', xLabel: 'Angle of attack (deg)', yLabel: 'Cm', title: 'Pitching moment' }, efficiency: { x: 'alpha', y: 'ld', xLabel: 'Angle of attack (deg)', yLabel: 'L / D', title: 'Aerodynamic efficiency' } };

export default function ResultsPlot({ runs, onClear }) {
  const [metric, setMetric] = useState('clAlpha');
  const spec = metrics[metric];
  const visible = runs.filter((run) => run.result?.points?.length);
  const traces = useMemo(() => visible.map((run, index) => ({
    x: run.result.points.map((point) => point[spec.x]),
    y: run.result.points.map((point) => spec.y === 'ld' ? (point.ld ?? point.cl / point.cd) : point[spec.y]),
    name: run.name,
    mode: 'lines+markers',
    line: { color: colors[index % colors.length], width: 2 },
    marker: { size: 5 }
  })), [visible, spec]);
  if (!visible.length) return <Card className="panel-card empty-results"><Card.Body><div className="empty-orbit"><i className="fa-solid fa-chart-line" /></div><h2>No analysis results yet</h2><p>Configure a case and run the solver. Results and run comparisons will appear here.</p></Card.Body></Card>;
  const latest = visible[visible.length - 1];
  return <div className="results-stack">
    <div className="results-toolbar"><div className="metric-tabs">{Object.entries(metrics).map(([key, item]) => <button key={key} className={metric === key ? 'active' : ''} onClick={() => setMetric(key)}>{item.title}</button>)}</div><Button variant="link" onClick={onClear}><i className="fa-solid fa-broom" /> Clear</Button></div>
    {latest.result.warning && <div className="demo-banner"><i className="fa-solid fa-flask" /><span><strong>Preview model</strong>{latest.result.warning}</span></div>}
    <Card className="plot-card"><Card.Body><Plot data={traces} layout={{ title: { text: spec.title, font: { color: '#e8f1fb', size: 18 } }, paper_bgcolor: 'transparent', plot_bgcolor: '#0a1625', font: { color: '#93a5b8', family: 'Inter, sans-serif' }, xaxis: { title: spec.xLabel, gridcolor: '#1d3045', zerolinecolor: '#39516b' }, yaxis: { title: spec.yLabel, gridcolor: '#1d3045', zerolinecolor: '#39516b' }, legend: { orientation: 'h', y: 1.12 }, margin: { l: 64, r: 25, t: 70, b: 58 } }} config={{ responsive: true, displaylogo: false }} useResizeHandler style={{ width: '100%', height: '420px' }} /></Card.Body></Card>
    <Card className="panel-card"><Card.Body><div className="table-title"><div><div className="section-kicker">Latest run</div><h2>{latest.name}</h2></div><span className={`mode-badge ${latest.result.mode}`}>{latest.result.mode}</span></div><div className="result-table-wrap"><Table responsive className="result-table"><thead><tr><th>Alpha</th><th>CL</th><th>CD</th><th>Cm</th><th>L / D</th></tr></thead><tbody>{latest.result.points.map((point, index) => <tr key={index}><td>{point.alpha?.toFixed(2)}</td><td>{point.cl?.toFixed(4)}</td><td>{point.cd?.toFixed(5)}</td><td>{point.cm?.toFixed(4)}</td><td>{(point.ld ?? point.cl / point.cd)?.toFixed(2)}</td></tr>)}</tbody></Table></div></Card.Body></Card>
  </div>;
}
