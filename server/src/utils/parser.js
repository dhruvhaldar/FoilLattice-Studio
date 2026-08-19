const numeric = (value) => {
  const parsed = Number(String(value).replace(/[dD]/g, 'E'));
  return Number.isFinite(parsed) ? parsed : null;
};

export function parseXfoilPolar(content) {
  const rows = [];
  for (const line of content.split(/\r?\n/)) {
    const values = line.trim().split(/\s+/).map(numeric);
    if (values.length >= 7 && values.slice(0, 7).every((value) => value !== null)) {
      const [alpha, cl, cd, cdp, cm, topXtr, botXtr] = values;
      rows.push({ alpha, cl, cd, cdp, cm, topXtr, botXtr, ld: cd ? cl / cd : null });
    }
  }
  return rows;
}

export function parseAvlStability(content) {
  const out = {};
  const aliases = { Alpha: 'alpha', CLtot: 'cl', CDtot: 'cd', Cmtot: 'cm', CYtot: 'cy', Cltot: 'clRoll', Cntot: 'cn', Xnp: 'neutralPoint' };
  for (const [source, target] of Object.entries(aliases)) {
    const match = content.match(new RegExp(`(?:^|\\s)${source}\\s*=\\s*([-+0-9.EeDd]+)`, 'm'));
    if (match) out[target] = numeric(match[1]);
  }
  for (const match of content.matchAll(/\b([A-Za-z][A-Za-z0-9_]{1,12})\s*=\s*([-+0-9.EeDd]+)/g)) {
    if (/^(C[lmnyx][a-z0-9_]+|[XYZ][a-z0-9_]+)$/i.test(match[1])) {
      out.derivatives ||= {};
      out.derivatives[match[1]] = numeric(match[2]);
    }
  }
  return out;
}

export function parseAvlStripForces(content) {
  const strips = [];
  for (const line of content.split(/\r?\n/)) {
    const values = line.trim().split(/\s+/).map(numeric);
    if (values.length >= 8 && values.slice(0, 8).every((value) => value !== null) && Number.isInteger(values[0])) {
      strips.push({ strip: values[0], y: values[1], chord: values[2], area: values[3], cl: values[7] });
    }
  }
  return strips;
}
