import { detailColumns, summaryColumns } from "./confirmedReport.js";

export async function buildConfirmedWorkbook(report) {
  const { default: ExcelJS } = await import("exceljs/dist/exceljs.min.js");
  const workbook = new ExcelJS.Workbook();
  const usedNames = new Set();

  function addSheet(name, columns, rows, widths) {
    const base = name.replace(/[:\\/?*\[\]\x00-\x1F]/g, " ").trim().replace(/^'+|'+$/g, "") || "Barangay";
    let sheetName = base.slice(0, 31).replace(/'+$/, "");
    for (let number = 2; usedNames.has(sheetName.toLowerCase()) || sheetName.toLowerCase() === "history"; number += 1) {
      const suffix = ` (${number})`;
      sheetName = base.slice(0, 31 - suffix.length) + suffix;
    }
    usedNames.add(sheetName.toLowerCase());
    const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
    sheet.columns = widths.map((width) => ({ width, alignment: { vertical: "top", wrapText: true } }));
    sheet.addRow(columns).font = { bold: true };
    sheet.addRows(rows);
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }

  addSheet("Summary", summaryColumns, report.map(({ summary }) => summary), [28, 36, 36, 15, 17, 12, 24]);
  for (const { barangay, details } of report) {
    addSheet(barangay.name, detailColumns, details, [30, 18, 22, 32, 32, 38]);
  }

  return workbook.xlsx.writeBuffer();
}

export async function downloadConfirmedWorkbook(report) {
  const buffer = await buildConfirmedWorkbook(report);
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "confirmed-barangays.xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
