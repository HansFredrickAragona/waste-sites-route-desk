import { useLayoutEffect, useRef, useState } from "react";
import { confirmedReport, detailColumns, summaryColumns } from "../confirmedReport.js";
import { downloadConfirmedWorkbook } from "../confirmedWorkbook.js";
import { DashboardDetailPage } from "./DashboardDetailPage.jsx";
import { ConfirmedReportEditor } from "./ConfirmedReportEditor.jsx";

function ConfirmedReport({ report, selected, onSelect, onOpenMap, canEdit, commitPinDraft, commitLineDraft }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const tableRegion = useRef(null);
  const summaryPosition = useRef(null);
  const menu = useRef(null);
  const menuTarget = useRef(null);
  const [editing, setEditing] = useState(null);

  function openEditMenu(event, target) {
    event.preventDefault();
    const popover = menu.current;
    const trigger = event.currentTarget.querySelector("button");
    popover.hidePopover();
    menuTarget.current = { target, trigger };
    trigger.focus({ preventScroll: true });
    popover.showPopover();
    const { width, height } = popover.getBoundingClientRect();
    const rowBounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX || rowBounds.left;
    const y = event.clientY || rowBounds.top;
    popover.style.left = `${Math.max(0, Math.min(x, document.documentElement.clientWidth - width))}px`;
    popover.style.top = `${Math.max(0, Math.min(y, window.innerHeight - height))}px`;
    popover.querySelector("button").focus({ preventScroll: true });
  }

  function openEditor(target, trigger) {
    menu.current.hidePopover();
    trigger.focus({ preventScroll: true });
    if (!canEdit(selected.barangay, target)) return;
    setEditing({ ...target, trigger });
  }

  function closeEditor() {
    const trigger = editing.trigger;
    setEditing(null);
    requestAnimationFrame(() => {
      (trigger.isConnected ? trigger : tableRegion.current)?.focus({ preventScroll: true });
    });
  }

  function openDetails(id) {
    summaryPosition.current = {
      pageTop: window.scrollY,
      tableTop: tableRegion.current.scrollTop,
      tableLeft: tableRegion.current.scrollLeft,
    };
    onSelect(id);
  }

  useLayoutEffect(() => {
    if (selected || !summaryPosition.current || !tableRegion.current) return;
    const { pageTop, tableTop, tableLeft } = summaryPosition.current;
    tableRegion.current.scrollTo({ top: tableTop, left: tableLeft, behavior: "instant" });
    window.scrollTo({ top: pageTop, behavior: "instant" });
    summaryPosition.current = null;
  }, [selected]);

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
    <>
      <div className="confirmed-report">
        <div className="confirmed-report-actions">
          {selected ? <>
            <button type="button" onClick={() => onSelect(null)}>‹ Back to Summary</button>
            <button type="button" onClick={() => onOpenMap(selected.barangay)}>Open Map</button>
          </> : <>
            <button type="button" onClick={exportAll} disabled={exporting || !report.length}>
              {exporting ? "Preparing workbook…" : "Export All (.xlsx)"}
            </button>
          </>}
        </div>
        {error && <p role="alert">{error}</p>}
        {rows.length ? (
          <div ref={tableRegion} className="confirmed-report-scroll" tabIndex={0} role="region" aria-label={selected ? "Barangay breakdown table" : "Confirmed summary table"}>
            <table>
              <thead><tr>{columns.map((column) => (
                <th key={column} scope="col" aria-sort={column === "Last Updated" ? "descending" : undefined}>{column}</th>
              ))}</tr></thead>
              <tbody>{rows.map(([name, ...values], index) => {
                const target = selected?.detailTargets[index];
                function activate(event) {
                  if (target) openEditor(target, event.currentTarget.closest("tr").querySelector("button"));
                  else openDetails(report[index].barangay.id);
                }
                return (
                  <tr key={target ? `${target.kind}:${target.item.id}` : report[index].barangay.id}
                    onClick={activate}
                    onContextMenu={target ? (event) => openEditMenu(event, target) : undefined}>
                    <th scope="row">
                      <button type="button" aria-label={target ? `Edit ${name}` : undefined} onClick={(event) => {
                        event.stopPropagation();
                        activate(event);
                      }}>{target ? name : `${name} ›`}</button>
                    </th>
                    {values.map((value, column) => <td key={columns[column + 1]}>{value === "" ? "—" : value}</td>)}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p className="kpi-detail-empty">{selected ? "No pick-up points or firing lines recorded." : "No barangays have been confirmed yet."}</p>}
        <div className="confirmed-report-edit-menu" ref={menu} popover="auto">
          <button type="button" onClick={() => {
            const { target, trigger } = menuTarget.current;
            openEditor(target, trigger);
          }}>Edit</button>
        </div>
      </div>
      {editing && selected && <ConfirmedReportEditor
        barangay={selected.barangay}
        target={editing}
        onClose={closeEditor}
        commitPinDraft={commitPinDraft}
        commitLineDraft={commitLineDraft}
      />}
    </>
  );
}

export function ConfirmedReportPage({ barangays, activityLog, selectedId, ...actions }) {
  const report = confirmedReport(barangays, activityLog);
  const selected = report.find(({ barangay }) => barangay.id === selectedId);

  return (
    <DashboardDetailPage title={selected?.barangay.name ?? "Confirmed Report"} count={selected ? selected.details.length : report.length}>
      <ConfirmedReport report={report} selected={selected} {...actions} />
    </DashboardDetailPage>
  );
}
