import React from 'react';

const classes = (...items) => items.filter(Boolean).join(' ');

export function Button({ variant = 'primary', className, children, ...props }) {
  return <button className={classes('btn', `btn-${variant}`, className)} {...props}>{children}</button>;
}

export function Row({ className, children, ...props }) {
  return <div className={classes('row', className)} {...props}>{children}</div>;
}

export function Col({ md, className, children, ...props }) {
  return <div className={classes('col', md && `col-md-${md}`, className)} {...props}>{children}</div>;
}

function CardRoot({ className, children, ...props }) {
  return <section className={classes('card', className)} {...props}>{children}</section>;
}
CardRoot.Body = function CardBody({ className, children, ...props }) {
  return <div className={classes('card-body', className)} {...props}>{children}</div>;
};
export const Card = CardRoot;

function FormRoot({ children, ...props }) { return <form {...props}>{children}</form>; }
FormRoot.Group = function FormGroup({ className, children, ...props }) { return <div className={classes('form-group', className)} {...props}>{children}</div>; };
FormRoot.Label = function FormLabel({ className, children, ...props }) { return <label className={classes('form-label', className)} {...props}>{children}</label>; };
FormRoot.Control = function FormControl({ className, ...props }) { return <input className={classes('form-control', className)} {...props} />; };
FormRoot.Check = function FormCheck({ label, className, type, ...props }) {
  return <label className={classes('form-check', type === 'switch' && 'form-switch', className)}><input type="checkbox" {...props} /><span>{label}</span></label>;
};
export const Form = FormRoot;

function DropdownRoot({ className, children }) { return <details className={classes('dropdown', className)}>{children}</details>; }
DropdownRoot.Toggle = function DropdownToggle({ variant = 'primary', className, children }) { return <summary className={classes('btn', `btn-${variant}`, className)}>{children}</summary>; };
DropdownRoot.Menu = function DropdownMenu({ className, children }) { return <div className={classes('dropdown-menu', className)}>{children}</div>; };
DropdownRoot.Header = function DropdownHeader({ children }) { return <div className="dropdown-header">{children}</div>; };
DropdownRoot.Item = function DropdownItem({ children, onClick }) { return <button className="dropdown-item" type="button" onClick={(event) => { onClick?.(event); event.currentTarget.closest('details')?.removeAttribute('open'); }}>{children}</button>; };
DropdownRoot.ItemText = function DropdownItemText({ children }) { return <div className="dropdown-item-text">{children}</div>; };
export const Dropdown = DropdownRoot;

export function ProgressBar({ now = 0 }) {
  const width = `${Math.max(0, Math.min(100, Number(now) || 0))}%`;
  return <div className="progress" role="progressbar" aria-valuenow={now} aria-valuemin="0" aria-valuemax="100"><div className="progress-bar" style={{ width }} /></div>;
}

export function Table({ responsive, className, children, ...props }) {
  const table = <table className={classes('table', className)} {...props}>{children}</table>;
  return responsive ? <div className="table-responsive">{table}</div> : table;
}
