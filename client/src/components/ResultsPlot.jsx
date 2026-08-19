import { useState } from 'react';
import { Button, Card, Table } from '../ui/primitives.jsx';

const colors = ['#48d8c5', '#ffba63', '#6ea8fe', '#d889ff', '#ff718b'];
const metrics = {
  clAlpha: { x: 'alpha', y: 'cl', xLabel: 'Angle of attack (deg)', yLabel: 'CL', title: 'Lift curve' },
  dragPolar: { x: 'cd', y: 'cl', xLabel: 'CD', yLabel: 'CL', title: 'Drag polar' },
  cmAlpha: { x: 'alpha', y: 'cm', xLabel: 'Angle of attack (deg)', yLabel: 'Cm', title: 'Pitching moment' },
  efficiency: { x: 'alpha', y: 'ld', xLabel: 'Angle of attack (deg)', yLabel: 'L / D', title: 'Aerodynamic efficiency' }
};

function Chart({ runs, spec }) {
  const width = 760, height = 410, margin = { left: 68, right: 24, top: 58, bottom: 58 };
  const series = runs.map((run) => ({ name: run.name, values: run.result.points.map((point) => ({ x: point[spec.x], y: spec.y === 'ld' ? (point.ld ?? point.cl / point.cd) : point[spec.y] })).filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)) }));
  const values = series.flatMap((item) => item.values);
  const extent = (key) => {
    const nums = values.map((point) => point[key]);
    let min = Math.min(...nums), max = Math.max(...nums);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * 0.08;
    return [min - pad, max + pad];
  };
  const [minX, maxX] = extent('x'), [minY, maxY] = extent('y');
  const sx = (value) => margin.left + (value - minX) / (maxX - minX) * (width - margin.left - margin.right);
  const sy = (value) => height - margin.bottom - (value - minY) / (maxY - minY) * (height - margin.top - margin.bottom);
  const ticks = Array.from({ length: 6 }, (_, index) => index / 5);
  return <div className="native-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={spec.title}>
    <text x={margin.left} y="28" className="chart-title">{spec.title}</text>
    {ticks.map((ratio) => <g key={`y${ratio}`}><line x1={margin.left} x2={width - margin.right} y1={sy(minY + ratio * (maxY - minY))} y2={sy(minY + ratio * (maxY - minY))} className="chart-grid" /><text x={margin.left - 10} y={sy(minY + ratio * (maxY - minY)) + 4} textAnchor="end" className="chart-tick">{(minY + ratio * (maxY - minY)).toFixed(2)}</text></g>)}
    {ticks.map((ratio) => <g key={`x${ratio}`}><line y1={margin.top} y2={height - margin.bottom} x1={sx(minX + ratio * (maxX - minX))} x2={sx(minX + ratio * (maxX - minX))} className="chart-grid" /><text x={sx(minX + ratio * (maxX - minX))} y={height - margin.bottom + 22} textAnchor="middle" className="chart-tick">{(minX + ratio * (maxX - minX)).toFixed(2)}</text></g>)}
    {series.map((item, index) => <g key={item.name}><polyline points={item.values.map((point) => `${sx(point.x)},${sy(point.y)}`).join(' ')} fill="none" stroke={colors[index % colors.length]} strokeWidth="2.5" />{item.values.map((point, pointIndex) => <circle key={pointIndex} cx={sx(point.x)} cy={sy(point.y)} r="3.5" fill={colors[index % colors.length]} />)}</g>)}
    <text x={(margin.left + width - margin.right) / 2} y={height - 10} textAnchor="middle" className="chart-label">{spec.xLabel}</text>
    <text transform={`translate(16 ${(margin.top + height - margin.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="chart-label">{spec.yLabel}</text>
  </svg><div className="chart-legend">{series.map((item, index) => <span key={item.name}><i style={{ background: colors[index % colors.length] }} />{item.name}</span>)}</div></div>;
}

export default function ResultsPlot({ runs, onClear }) {
  const [metric, setMetric] = useState('clAlpha');
  const spec = metrics[metric];
  const visible = runs.filter((run) => run.result?.points?.length);
  if (!visible.length) return <Card className="panel-card empty-results"><Card.Body><div className="empty-orbit"><i className="fa-solid fa-chart-line" /></div><h2>No analysis results yet</h2><p>Configure a case and run the solver. Results and run comparisons will appear here.</p></Card.Body></Card>;
  const latest = visible[visible.length - 1];
  return <div className="results-stack">
    <div className="results-toolbar"><div className="metric-tabs">{Object.entries(metrics).map(([key, item]) => <button key={key} className={metric === key ? 'active' : ''} onClick={() => setMetric(key)}>{item.title}</button>)}</div><Button variant="link" onClick={onClear}>Clear</Button></div>
    {latest.result.warning && <div className="demo-banner"><span><strong>Preview model</strong>{latest.result.warning}</span></div>}
    <Card className="plot-card"><Card.Body><Chart runs={visible} spec={spec} /></Card.Body></Card>
    <Card className="panel-card"><Card.Body><div className="table-title"><div><div className="section-kicker">Latest run</div><h2>{latest.name}</h2></div><span className={`mode-badge ${latest.result.mode}`}>{latest.result.mode}</span></div><div className="result-table-wrap"><Table responsive className="result-table"><thead><tr><th>Alpha</th><th>CL</th><th>CD</th><th>Cm</th><th>L / D</th></tr></thead><tbody>{latest.result.points.map((point, index) => <tr key={index}><td>{point.alpha?.toFixed(2)}</td><td>{point.cl?.toFixed(4)}</td><td>{point.cd?.toFixed(5)}</td><td>{point.cm?.toFixed(4)}</td><td>{(point.ld ?? point.cl / point.cd)?.toFixed(2)}</td></tr>)}</tbody></Table></div></Card.Body></Card>
  </div>;
}
