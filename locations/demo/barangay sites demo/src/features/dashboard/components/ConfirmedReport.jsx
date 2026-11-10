import { useState } from "react";
import { confirmedReport, detailColumns, summaryColumns } from "../confirmedReport.js";
import { downloadConfirmedWorkbook } from "../confirmedWorkbook.js";
import { DashboardDetailPage } from "./DashboardDetailPage.jsx";

function ConfirmedReport({ report, selected, onSelect, onOpenMap }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function exportAll() {
    setExporting(true);
    setError("");
    try {
      await downloadConfirmedWorkbook(report);
    } catch {
      setError("The workbook could not be downloaded. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  const columns = selected ? detailColumns : summaryColumns;
  const rows = selected ? selected.details : report.map(({ summary }) => summary);

  return (
    <div className="confirmed-report">
      <div className="confirmed-report-actions">
        {selected ? <>
          <button type="button" onClick={() => onSelect(null)}>‹ Back to Summary</button>
          <button type="button" onClick={() => onOpenMap(selected.barangay)}>Open Map</button>
        </> : (
          <button type="button" onClick={exportAll} disabled={exporting || !report.length}>
            {exporting ? "Preparing workbook…" : "Export All (.xlsx)"}
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
      {rows.length ? (
        <div className="confirmed-report-scroll" tabIndex={0} role="region" aria-label={selected ? "Barangay breakdown table" : "Confirmed summary table"}>
          <table>
            <thead><tr>{columns.map((column) => (
              <th key={column} scope="col" aria-sort={column === "Last Updated" ? "descending" : undefined}>{column}</th>
            ))}</tr></thead>
            <tbody>{rows.map(([name, ...values], index) => (
              <tr key={selected ? index : report[index].barangay.id} onClick={selected ? undefined : () => onSelect(report[index].barangay.id)}>
                <th scope="row">{selected ? name : (
                  <button type="button" onClick={(event) => {
                    event.stopPropagation();
                    onSelect(report[index].barangay.id);
                  }}>{name} ›</button>
                )}</th>
                {values.map((value, column) => <td key={columns[column + 1]}>{value === "" ? "—" : value}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="kpi-detail-empty">{selected ? "No pick-up points or firing lines recorded." : "No barangays have been confirmed yet."}</p>}
    </div>
  );
}

export function ConfirmedReportPage({ barangays, activityLog, selectedId, onSelect, onOpenMap }) {
  const report = confirmedReport(barangays, activityLog);
  const selected = report.find(({ barangay }) => barangay.id === selectedId);

  return (
    <DashboardDetailPage title={selected?.barangay.name ?? "Confirmed Report"} count={selected ? selected.details.length : report.length}>
      <ConfirmedReport report={report} selected={selected} onSelect={onSelect} onOpenMap={onOpenMap} />
    </DashboardDetailPage>
  );
}
