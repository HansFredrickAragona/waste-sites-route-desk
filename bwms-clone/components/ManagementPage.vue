<script setup lang="ts">
import AppShell from '~/components/AppShell.vue';
import RecordModal from '~/components/RecordModal.vue';
import ActivityModal from '~/components/ActivityModal.vue';
import { useManagementPage } from '~/composables/useManagementPage';

const props = defineProps<{ pagePath: string }>();
const pagePath = props.pagePath;
const {
  definition,
  recordStore,
  search,
  statusFilter,
  dateFilter,
  dateRangeStart,
  dateRangeEnd,
  datePickerOpen,
  dateCalendarMonth,
  sourceFilter,
  sourceSearch,
  sourceFilterOpen,
  datePresets,
  currentPage,
  pageSize,
  sortBy,
  sortDirection,
  modalOpen,
  modalTitle,
  editingRecord,
  activityOpen,
  previewRecord,
  pendingDelete,
  toast,
  rows,
  isWasteReport,
  vehicleOptions,
  siteOptions,
  statusOptions,
  sourceOptions,
  matchingSourceOptions,
  dateColumn,
  dateToISO,
  dateKey,
  dateFromKey,
  formatDateKey,
  formatCalendarMonth,
  dateCalendarMonths,
  dateCalendarHeading,
  dateFilterLabel,
  calendarDays,
  dateCellClasses,
  shiftDateCalendar,
  selectCalendarDate,
  applyDatePreset,
  clearDateFilter,
  selectSource,
  filteredRows,
  totalPages,
  visibleRows,
  visibleStart,
  visibleEnd,
  openCreate,
  openEdit,
  dateLabel,
  toLocalDateTimeInput,
  localDateTimeNow,
  timeLabel,
  departureLabel,
  detailValue,
  numericWeight,
  makeRow,
  saveRecord,
  confirmDelete,
  markDeparted,
  editSelectedRecord,
  deleteSelectedRecord,
  showToast,
  exportCsv,
  sortColumn,
  statusClass,
  cellClass,
} = useManagementPage(pagePath);
</script>

<template>
  <AppShell v-if="definition">
    <div class="page-heading">
      <div><h1>{{ definition.heading }}</h1><p>{{ definition.description }}</p></div>
      <div class="heading-actions">
        <button v-if="definition.exportLabel" class="button button-quiet export-button" @click="exportCsv"><span v-if="pagePath === '/biodegradable'" class="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3H6v18h12V10z"/><path d="M13 3v7h5M12 12v7m-3-3 3 3 3-3"/></svg></span><span v-else class="button-icon">⇩</span> {{ definition.exportLabel }}</button>
        <template v-if="definition.actions?.length">
          <button v-for="action in definition.actions" :key="action" class="button" :class="action === 'Record Incoming' ? 'button-primary' : ''" @click="openCreate(action)"><span class="button-icon">{{ action === 'Record Incoming' ? '+' : '＋' }}</span>{{ action }}</button>
        </template>
        <button v-else class="button button-primary" @click="openCreate()"><span class="button-icon">＋</span>{{ definition.addLabel }}</button>
      </div>
    </div>

    <section class="table-panel">
      <div class="table-toolbar" :class="{ 'report-toolbar': isWasteReport }" @keydown.esc="datePickerOpen = false; sourceFilterOpen = false">
        <label class="search-box"><span class="search-symbol">⌕</span><input v-model="search" type="search" :placeholder="isWasteReport || pagePath === '/biodegradable' ? 'Search...' : 'Search records...'" aria-label="Search records" /><button v-if="search" class="search-clear" aria-label="Clear search" @click="search = ''">×</button></label>
        <div v-if="isWasteReport || pagePath === '/biodegradable'" class="date-filter-wrap" @click.stop>
          <div class="date-filter-trigger-row">
            <button class="toolbar-date-button" :class="{ 'filter-active': dateRangeStart, 'has-date-clear': dateRangeStart }" aria-label="Filter by date" :aria-expanded="datePickerOpen" @click="datePickerOpen = !datePickerOpen; sourceFilterOpen = false">
              <span class="filter-calendar-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="1.7"/><path d="M7.5 3.5v4M16.5 3.5v4M4 9.5h16"/></svg></span><span>{{ dateFilterLabel }}</span>
            </button>
            <button v-if="dateRangeStart" class="date-filter-clear" aria-label="Clear date filter" @click="clearDateFilter">×</button>
          </div>
          <div v-if="datePickerOpen" class="date-picker-popover" role="dialog" aria-label="Filter by date">
            <div class="date-shortcuts">
              <button v-for="preset in datePresets" :key="preset.label" @click="applyDatePreset(preset.value)">{{ preset.label }}</button>
            </div>
            <div class="date-calendar">
              <div class="date-calendar-header">
                <button aria-label="Previous year" @click="shiftDateCalendar(-12)">«</button><button aria-label="Previous month" @click="shiftDateCalendar(-1)">‹</button>
                <strong>{{ dateCalendarHeading }}</strong>
                <button aria-label="Next month" @click="shiftDateCalendar(1)">›</button><button aria-label="Next year" @click="shiftDateCalendar(12)">»</button>
              </div>
              <div class="date-month-grid">
                <section v-for="month in dateCalendarMonths" :key="dateKey(month)" class="date-month">
                  <h3>{{ formatCalendarMonth(month) }}</h3>
                  <div class="date-days-grid">
                    <span v-for="(weekday, index) in ['S', 'M', 'T', 'W', 'T', 'F', 'S']" :key="`${dateKey(month)}-${index}`" class="date-weekday">{{ weekday }}</span>
                    <button v-for="day in calendarDays(month)" :key="dateKey(day)" :class="dateCellClasses(day, month)" :aria-pressed="dateKey(day) === dateRangeStart || dateKey(day) === dateRangeEnd" @click="selectCalendarDate(day)">{{ day.getDate() }}</button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
        <div v-if="isWasteReport || pagePath === '/biodegradable'" class="source-filter-wrap" @click.stop>
          <button class="toolbar-source-button" :class="{ 'filter-active': sourceFilter }" :aria-label="isWasteReport ? 'Filter by Source' : 'Filter by From'" :aria-expanded="sourceFilterOpen" @click="sourceFilterOpen = !sourceFilterOpen; datePickerOpen = false">
            <span>{{ sourceFilter || (isWasteReport ? 'Filter by Source' : 'Filter by From') }}</span><span class="source-filter-chevron">⌄</span>
          </button>
          <div v-if="sourceFilterOpen" class="source-filter-popover" role="dialog" :aria-label="isWasteReport ? 'Filter by Source' : 'Filter by From'">
            <label class="source-filter-search"><span>⌕</span><input v-model="sourceSearch" type="search" placeholder="Search..." aria-label="Search sources" /></label>
            <button v-if="sourceFilter" class="source-filter-reset" @click="sourceFilter = ''; sourceFilterOpen = false">All Sources</button>
            <div v-if="matchingSourceOptions.length" class="source-filter-options" role="listbox" :aria-label="isWasteReport ? 'Waste sources' : 'Record sources'">
              <button v-for="source in matchingSourceOptions" :key="source" role="option" :aria-selected="sourceFilter === source" @click="selectSource(source)"><span>{{ source }}</span><span v-if="sourceFilter === source">✓</span></button>
            </div>
            <p v-else class="source-filter-empty">No sources found.</p>
          </div>
        </div>
        <label v-else-if="definition.dateFilter" class="filter-control"><span class="sr-only">Filter by date</span><input v-model="dateFilter" class="toolbar-date" type="date" aria-label="Filter by date" /></label>
        <select v-if="!isWasteReport && statusOptions.length" v-model="statusFilter" class="toolbar-select" aria-label="Filter by status"><option>All</option><option v-for="status in statusOptions" :key="status">{{ status }}</option></select>
        <div class="toolbar-spacer" />
        <button class="button button-quiet activity-button" @click="activityOpen = true"><span class="button-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h3l2-5 4 10 3-7 2 2h4"/></svg></span> Activity Logs</button>
      </div>
      <div class="table-meta"><span>Showing <strong>{{ visibleStart }}–{{ visibleEnd }}</strong> of <strong>{{ filteredRows.length }}</strong> records</span><span>Sorted by {{ sortBy ? definition.columns.find((column) => column.key === sortBy)?.label : 'recently updated' }}</span></div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th v-if="!isWasteReport" class="actions-header">Actions</th><th v-for="column in definition.columns" :key="column.key"><span v-if="pagePath === '/biodegradable' && column.key !== 'inputDate'">{{ column.label }}</span><button v-else class="sortable-head" @click="sortColumn(column.key)">{{ column.label }}<span class="sort-mark">{{ sortBy === column.key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕' }}</span></button></th></tr></thead>
          <tbody>
            <tr v-for="record in visibleRows" :key="record.id" :class="{ 'row-clickable': isWasteReport }" :tabindex="isWasteReport ? 0 : undefined" @click="isWasteReport ? previewRecord = record : undefined" @keydown.enter="isWasteReport ? previewRecord = record : undefined">
              <td v-if="!isWasteReport"><div class="row-actions"><button class="row-button" @click.stop="openEdit(record)"><span v-if="pagePath === '/biodegradable'" class="row-action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.7-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"/></svg></span><span v-else>✎</span> Edit</button><button v-if="pagePath === '/haulers/hauling-reports'" class="row-button view" @click.stop="previewRecord = record"><span>◉</span> Preview</button><button class="row-button delete" @click.stop="pendingDelete = record"><span v-if="pagePath === '/biodegradable'" class="row-action-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l.9 13h10.2L18 7M9 7V4h6v3"/></svg></span><span v-else>⌫</span> Delete</button></div></td>
              <td v-for="column in definition.columns" :key="`${record.id}-${column.key}`">
                <span v-if="column.key === 'status'" class="status-pill" :class="statusClass(record[column.key])">{{ record[column.key] || '—' }}</span>
                <template v-else-if="isWasteReport && column.key === 'departure'">
                  <button v-if="!record.departureAt && record.status !== 'Completed'" class="row-button depart-action" @click.stop="markDeparted(record)"><span>↗</span> Depart</button>
                  <span v-else class="cell-text departure-stamp">{{ departureLabel(record) }}</span>
                </template>
                <span v-else class="cell-text" :class="cellClass(column.key)" :title="String(record[column.key] ?? '')">{{ record[column.key] ?? '—' }}</span>
              </td>
            </tr>
            <tr v-if="visibleRows.length === 0"><td :colspan="definition.columns.length + (isWasteReport ? 0 : 1)" class="empty-state">No records match the current filters.</td></tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span>Page {{ currentPage }} of {{ totalPages }}</span>
        <div class="page-controls"><button class="page-control" :disabled="currentPage === 1" aria-label="First page" @click="currentPage = 1">«</button><button class="page-control" :disabled="currentPage === 1" aria-label="Previous page" @click="currentPage--">‹</button><button v-for="page in totalPages" :key="page" class="page-control" :class="{ active: currentPage === page }" @click="currentPage = page">{{ page }}</button><button class="page-control" :disabled="currentPage === totalPages" aria-label="Next page" @click="currentPage++">›</button><button class="page-control" :disabled="currentPage === totalPages" aria-label="Last page" @click="currentPage = totalPages">»</button></div>
      </div>
      <div class="demo-note">Showing local demonstration records. Changes are saved in this browser session only.</div>
    </section>

    <RecordModal v-if="modalOpen" :definition="definition" :initial="editingRecord" :action-title="modalTitle" :vehicles="vehicleOptions" :sites="siteOptions" @close="modalOpen = false" @save="saveRecord" />
    <ActivityModal v-if="activityOpen" @close="activityOpen = false" />
    <div v-if="previewRecord" class="modal-backdrop" @click.self="previewRecord = null"><section class="confirm-modal" role="dialog" aria-modal="true"><header class="modal-header"><div><span class="eyebrow">Record details</span><h2>{{ definition.heading }}</h2><p>Record #{{ previewRecord.id }} · {{ previewRecord.status }}</p></div><button class="modal-close" aria-label="Close dialog" @click="previewRecord = null">×</button></header><div class="preview-fields"><div v-for="column in definition.columns" :key="column.key"><span>{{ column.label }}</span><strong>{{ detailValue(previewRecord, column.key) }}</strong></div></div><div class="modal-actions"><button class="button button-quiet" @click="previewRecord = null">Close</button><button class="button button-danger" @click="deleteSelectedRecord">Delete</button><button class="button button-primary" @click="editSelectedRecord">Edit Record</button></div></section></div>
    <div v-if="pendingDelete" class="modal-backdrop" @click.self="pendingDelete = null"><section class="confirm-modal" role="alertdialog" aria-modal="true" aria-label="Remove record"><header class="modal-header"><div><span class="eyebrow">Remove record</span><h2>Delete this record?</h2></div><button class="modal-close" aria-label="Close dialog" @click="pendingDelete = null">×</button></header><div class="confirm-body">This removes the record from the local demo list. <strong>This action only affects this browser session.</strong></div><div class="modal-actions"><button class="button button-quiet" @click="pendingDelete = null">Cancel</button><button class="button button-danger" @click="confirmDelete">Delete Record</button></div></section></div>
    <div v-if="toast" class="toast" role="status"><span>✓</span>{{ toast }}</div>
  </AppShell>
</template>

<style scoped>
.actions-header { min-width: 150px; }
.row-clickable { cursor: pointer; }
.row-clickable:hover { background: #20282a !important; }
.depart-action { border-color: #267549; color: #8ce5a8; background: #153c27; }
.depart-action:hover { border-color: #40a766; background: #1c4f32; }
.departure-stamp { color: #d8e8dc; font-weight: 550; }
.filter-control { display: contents; }
.activity-button { margin-left: auto; }
.report-toolbar .search-box { width: min(245px, 100%); }
.date-filter-wrap, .source-filter-wrap { position: relative; z-index: 2; }
.source-filter-wrap { z-index: 3; }
.date-filter-trigger-row { display: flex; align-items: center; }
.toolbar-date-button, .toolbar-source-button { display: flex; align-items: center; justify-content: flex-start; gap: 8px; height: 36px; padding: 0 10px; border: 1px solid var(--border-strong); border-radius: 5px; color: var(--text); background: var(--surface-soft); font-size: 12px; white-space: nowrap; cursor: pointer; }
.toolbar-date-button { min-width: 150px; max-width: 230px; }
.toolbar-date-button > span:nth-child(2) { overflow: hidden; text-overflow: ellipsis; }
.toolbar-date-button.has-date-clear { border-radius: 5px 0 0 5px; }
.toolbar-date-button:hover, .toolbar-source-button:hover, .filter-active { border-color: #4d9068; }
.filter-calendar-icon { color: var(--muted); }
.date-filter-clear { width: 30px; height: 36px; border: 1px solid var(--border-strong); border-left: 0; border-radius: 0 5px 5px 0; color: var(--muted); background: var(--surface-soft); font-size: 17px; cursor: pointer; }
.date-picker-popover, .source-filter-popover { position: absolute; top: calc(100% + 8px); left: 0; z-index: 30; border: 1px solid var(--border-strong); border-radius: 8px; color: var(--text); background: var(--surface); box-shadow: 0 18px 42px #0008; }
.date-picker-popover { display: flex; left: -255px; width: min(690px, calc(100vw - 32px)); padding: 12px; }
.date-shortcuts { display: flex; flex: 0 0 118px; flex-direction: column; gap: 3px; padding-right: 10px; border-right: 1px solid var(--border); }
.date-shortcuts button { padding: 8px 7px; border: 0; border-radius: 5px; color: var(--muted); background: transparent; text-align: left; font-size: 11px; cursor: pointer; }
.date-shortcuts button:hover { color: var(--text); background: var(--surface-raised); }
.date-calendar { min-width: 0; flex: 1; padding-left: 10px; }
.date-calendar-header { display: grid; grid-template-columns: 25px 25px minmax(0, 1fr) 25px 25px; align-items: center; gap: 3px; margin: 0 0 8px; }
.date-calendar-header strong { overflow: hidden; color: var(--text); font-size: 11px; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.date-calendar-header button { width: 25px; height: 25px; border: 0; border-radius: 4px; color: var(--muted); background: transparent; font-size: 15px; cursor: pointer; }
.date-calendar-header button:hover { color: var(--text); background: var(--surface-raised); }
.date-month-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.date-month h3 { margin: 0 0 7px; color: var(--muted); font-size: 10px; font-weight: 600; text-align: center; }
.date-days-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 2px; }
.date-weekday { display: grid; height: 22px; place-items: center; color: var(--subtle); font-size: 9px; font-weight: 650; }
.date-days-grid button { display: grid; min-width: 0; height: 25px; padding: 0; place-items: center; border: 0; border-radius: 50%; color: var(--text); background: transparent; font-size: 10px; cursor: pointer; }
.date-days-grid button:hover { background: var(--surface-raised); }
.date-days-grid .calendar-outside-month { color: var(--subtle); }
.date-days-grid .calendar-in-range { border-radius: 5px; color: #c9f4d5; background: #235338; }
.date-days-grid .calendar-range-start, .date-days-grid .calendar-range-end { color: #101914; background: #69d58c; font-weight: 700; }
.toolbar-source-button { justify-content: space-between; width: 210px; max-width: min(260px, calc(100vw - 32px)); gap: 18px; }
.toolbar-source-button > span:first-child { overflow: hidden; text-overflow: ellipsis; }
.source-filter-chevron { color: var(--muted); font-size: 14px; }
.source-filter-popover { width: min(270px, calc(100vw - 32px)); padding: 8px; }
.source-filter-search { position: relative; display: block; margin-bottom: 6px; }
.source-filter-search > span { position: absolute; top: 6px; left: 9px; color: var(--subtle); font-size: 15px; }
.source-filter-search input { width: 100%; height: 32px; padding: 0 9px 0 30px; border: 1px solid var(--border-strong); border-radius: 5px; color: var(--text); background: var(--surface-soft); font: inherit; font-size: 11px; outline: none; }
.source-filter-search input:focus { border-color: #5e94e7; }
.source-filter-reset, .source-filter-options button { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 9px; border: 0; border-radius: 5px; color: var(--muted); background: transparent; text-align: left; font-size: 11px; cursor: pointer; }
.source-filter-options { max-height: 238px; overflow: auto; }
.source-filter-options button:hover, .source-filter-reset:hover, .source-filter-options button[aria-selected="true"] { color: var(--text); background: var(--surface-raised); }
.source-filter-options button span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.source-filter-empty { margin: 0; padding: 12px 9px; color: var(--muted); font-size: 11px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.preview-fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 0 18px; padding: 10px 22px; }
.preview-fields > div { display: flex; flex-direction: column; gap: 4px; padding: 11px 0; border-bottom: 1px solid var(--border); }
.preview-fields span { color: var(--muted); font-size: 10px; }
.preview-fields strong { overflow-wrap: anywhere; font-size: 12px; font-weight: 550; }
@media (max-width: 760px) {
  .activity-button { margin-left: 0; }
  .preview-fields { grid-template-columns: 1fr; padding: 5px 15px; }
  .report-toolbar .search-box { width: 100%; }
  .date-filter-wrap, .source-filter-wrap { flex: 1; min-width: calc(50% - 4px); }
  .date-filter-trigger-row, .toolbar-date-button, .toolbar-source-button { width: 100%; }
  .toolbar-date-button { min-width: 0; }
  .date-picker-popover { left: 0; width: min(690px, calc(100vw - 26px)); padding: 8px; }
  .date-shortcuts { flex-basis: 96px; padding-right: 6px; }
  .date-calendar { padding-left: 6px; }
  .date-month-grid { gap: 5px; }
  .date-days-grid { gap: 1px; }
  .date-days-grid button { height: 22px; font-size: 9px; }
}
</style>
