export function validation(message) {
  return Object.assign(new Error(message), { name: 'ValidationError' });
}

export function number(value, name, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw validation(`${name} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

export function text(value, name, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw validation(`${name} is required and must be at most ${max} characters`);
  }
  return value.trim().replace(/[\r\n]/g, ' ');
}

export function sweep(input = {}) {
  const start = number(input.start, 'Sweep start', { min: -90, max: 90 });
  const end = number(input.end, 'Sweep end', { min: -90, max: 90 });
  const step = number(input.step, 'Sweep step', { min: 0.01, max: 30 });
  if (end < start) throw validation('Sweep end must be greater than or equal to sweep start');
  if ((end - start) / step > 400) throw validation('Sweep may contain at most 401 points');
  return { start, end, step };
}
