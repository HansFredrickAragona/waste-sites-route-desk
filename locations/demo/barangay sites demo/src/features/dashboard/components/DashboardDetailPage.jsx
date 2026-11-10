import { formatNumber } from "../../../shared/utils/reviewFormatting.js";
import "./confirmedReport.css";

export function DashboardDetailPage({ title, count, children }) {
  return (
    <section className="dashboard-view dashboard-kpi-page" aria-labelledby="dashboard-kpi-title">
      <div className="dashboard-heading">
        <h1 id="dashboard-kpi-title">{title}</h1>
        <span className="dashboard-coverage-tag">{formatNumber(count)}</span>
      </div>
      <div className="dashboard-kpi-content">{children}</div>
    </section>
  );
}
