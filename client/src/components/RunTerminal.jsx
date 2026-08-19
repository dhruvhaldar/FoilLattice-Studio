import { useEffect, useRef } from 'react';

export default function RunTerminal({ lines, status }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [lines]);
  return <div className="terminal-shell"><div className="terminal-bar"><span className="dot red" /><span className="dot yellow" /><span className="dot green" /><span>solver output</span><span className={`terminal-status ${status}`}>{status}</span></div><pre ref={ref}>{lines.length ? lines.join('') : '$ Waiting for an analysis job…\n'}{status === 'running' && <span className="cursor">▌</span>}</pre></div>;
}
