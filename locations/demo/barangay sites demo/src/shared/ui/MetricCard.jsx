import { formatNumber } from "../utils/reviewFormatting.js";

export function MetricCard({ tone, label, value, detail, icon, compact = false, onClick }) {
  const className = `dashboard-metric dashboard-metric--${tone}${compact ? " dashboard-metric--compact" : ""}${onClick ? " dashboard-metric-button" : ""}`;
  const content = <><div className="dashboard-metric-topline">{!compact && <span className="dashboard-metric-icon-wrap"><span className="dashboard-metric-icon" aria-hidden="true">{icon}</span></span>}<span className="dashboard-metric-label">{label}</span></div><strong className="dashboard-metric-value">{formatNumber(value)}</strong>{!compact && <p className="dashboard-metric-description">{detail}</p>}{onClick && <span className="dashboard-metric-hint">View list <span aria-hidden="true">↗</span></span>}</>;
  if (onClick) return <button className={className} type="button" onClick={onClick} aria-label={`${label}: ${formatNumber(value)}. View list.`} aria-haspopup="dialog">{content}</button>;
  return <article className={className}>{content}</article>;
}
