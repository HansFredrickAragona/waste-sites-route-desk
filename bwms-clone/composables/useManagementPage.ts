import { computed, ref } from 'vue';
import { pageRegistry, seedRecords, type PageDefinition, type RecordRow } from '~/data/pages';
import { useRecordFilters } from '~/composables/useRecordFilters';

export function useManagementPage(pagePath: string) {
  const definition = computed<PageDefinition | null>(() => pageRegistry[pagePath] || null);
  if (!definition.value) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' });
  }
  const recordStore = useState<Record<string, RecordRow[]>>('bwms-demo-records', seedRecords);
  const modalOpen = ref(false);
  const modalTitle = ref('');
  const editingRecord = ref<RecordRow | null>(null);
  const activityOpen = ref(false);
  const previewRecord = ref<RecordRow | null>(null);
  const pendingDelete = ref<RecordRow | null>(null);
  const toast = ref('');
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  const rows = computed(() => recordStore.value[pagePath] || []);
  const isWasteReport = computed(() => pagePath === '/lgu/management-records');
  const vehicleOptions = computed(() => (recordStore.value['/lgu/vehicle-records'] || []).map((vehicle) => ({
    plate: String(vehicle.plate || ''),
    driver: String(vehicle.driver || ''),
    tare: String(vehicle.tare || ''),
  })).filter((vehicle) => vehicle.plate));
  const siteOptions = computed(() => [...new Set((recordStore.value['/lgu/collection_route'] || []).map((site) => String(site.site || '')).filter(Boolean))]);
  const {
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
  } = useRecordFilters({ rows, definition, isWasteReport, siteOptions });

  function openCreate(action = '') {
    editingRecord.value = null;
    modalTitle.value = action;
    modalOpen.value = true;
  }

  function openEdit(record: RecordRow) {
    const initial: RecordRow = { ...record };
    if (pagePath === '/lgu/driver-records') {
      const names = String(record.name || '').split(' ');
      initial.firstName = names.shift() || '';
      initial.lastName = names.pop() || '';
      initial.middleName = names.join(' ');
      initial.weight = String(record.weight || '').replace(/\s*kg$/i, '');
    }
    if (pagePath === '/lgu/vehicle-records') initial.tare = String(record.tare || '').replace(/[\s,]*kg$/i, '').replaceAll(',', '');
    if (pagePath === '/lgu/collection_route') {
      const [latitude = '', longitude = ''] = String(record.coordinates || '').split(',').map((part) => part.trim());
      initial.latitude = latitude;
      initial.longitude = longitude;
    }
    if (pagePath === '/lgu/management-records') {
      initial.gross = String(record.gross || '').replace(/[\s,]*kg$/i, '').replaceAll(',', '');
      initial.arrivedAt = toLocalDateTimeInput(record.arrivedAt || `${record.date} ${record.arrival}`);
      initial.departureAt = toLocalDateTimeInput(record.departureAt);
      initial.sourceSites = record.sourceSites || record.source || '';
    }
    if (pagePath === '/haulers/hauling-reports' || pagePath === '/recyclables/recyclable-reports') {
      initial.date = dateToISO(record.date);
      for (const key of ['gross', 'tare']) initial[key] = String(record[key] || '').replace(/[\s,]*kg$/i, '').replaceAll(',', '');
    }
    if (pagePath === '/biodegradable') initial.date = dateToISO(record.date);
    editingRecord.value = initial;
    modalTitle.value = '';
    modalOpen.value = true;
  }

  function dateLabel(value: unknown) {
    if (!value) return new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function toLocalDateTimeInput(value: unknown) {
    if (!value || value === '—') return '';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function localDateTimeNow() {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function timeLabel(value: unknown) {
    if (!value) return '—';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function departureLabel(record: RecordRow) {
    return record.departureAt ? `${dateLabel(record.departureAt)} · ${timeLabel(record.departureAt)}` : '—';
  }

  function detailValue(record: RecordRow, key: string) {
    if (isWasteReport.value && key === 'departure') return departureLabel(record);
    return record[key] ?? '—';
  }

  function numericWeight(value: unknown) {
    const number = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(number) ? number : 0;
  }

  function makeRow(values: Record<string, string | number>, existing?: RecordRow | null): RecordRow {
    const path = pagePath;
    const now = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
    const row: RecordRow = { ...(existing || {}), ...values, id: existing?.id || Math.max(0, ...rows.value.map((item) => item.id)) + 1 };
    if ('date' in values) row.date = dateLabel(values.date);
    if (definition.value?.columns.some((column) => column.key === 'updated')) row.updated = now;
    if (path === '/lgu/driver-records') {
      row.name = [values.firstName, values.middleName, values.lastName, values.suffix].filter(Boolean).join(' ');
      row.weight = `${values.weight || 0} kg`;
      row.status = existing?.status || 'Active';
    } else if (path === '/lgu/vehicle-records') {
      row.tare = `${values.tare || 0} kg`;
      row.status = existing?.status || 'On Duty';
    } else if (path === '/lgu/collection_route') {
      row.coordinates = `${values.latitude || '—'}, ${values.longitude || '—'}`;
      row.created = existing?.created || now;
    } else if (path === '/waste-collection-schedules') {
      row.rows = existing?.rows || 1;
      row.active = values.active || existing?.active || 1;
      row.offDuty = values.offDuty || existing?.offDuty || 0;
      row.created = existing?.created || now;
    } else if (path === '/lgu/management-records') {
      const vehicle = (recordStore.value['/lgu/vehicle-records'] || []).find((item) => String(item.plate) === String(values.plate));
      const gross = numericWeight(values.gross);
      const tare = numericWeight(vehicle?.tare || values.tare);
      const arrivedAt = existing
        ? String(values.arrivedAt || existing.arrivedAt || localDateTimeNow())
        : localDateTimeNow();
      let departureAt = values.departureAt === undefined ? String(existing?.departureAt || '') : String(values.departureAt || '');
      const status = String(values.status || existing?.status || 'Pending Departure');
      if (status === 'Completed' && !departureAt) departureAt = localDateTimeNow();
      const sourceSites = String(values.sourceSites || existing?.sourceSites || '');
      Object.assign(row, {
        status,
        date: dateLabel(arrivedAt),
        plate: String(values.plate || existing?.plate || ''),
        gross: `${gross.toLocaleString()} kg`,
        tare: `${tare.toLocaleString()} kg`,
        net: `${Math.max(0, gross - tare).toLocaleString()} kg`,
        departureAt,
        departure: departureAt ? `${dateLabel(departureAt)} · ${timeLabel(departureAt)}` : '—',
        arrivedAt,
        arrival: timeLabel(arrivedAt),
        sourceSites,
        source: sourceSites,
        driver: String(values.driver ?? vehicle?.driver ?? existing?.driver ?? ''),
        updated: now,
      });
    } else if (path === '/recyclables/recyclable-reports') {
      const gross = Number(values.gross || 0);
      const tare = Number(values.tare || 0);
      row.gross = `${gross.toLocaleString()} kg`;
      row.tare = `${tare.toLocaleString()} kg`;
      row.net = `${Math.max(0, gross - tare).toLocaleString()} kg`;
      row.updated = now;
    } else if (path === '/haulers/hauling-reports') {
      const gross = Number(values.gross || 0);
      const tare = Number(values.tare || 0);
      row.gross = `${gross.toLocaleString()} kg`;
      row.tare = `${tare.toLocaleString()} kg`;
      row.net = `${Math.max(0, gross - tare).toLocaleString()} kg`;
      row.status = existing?.status || 'Complete';
      row.updated = now;
    } else if (path === '/biodegradable') {
      row.date = dateLabel(values.date);
      row.volume = Number(values.volume || 0).toFixed(2);
      row.bed = values.bed;
      row.establishment = values.establishment;
      row.source = values.source;
      row.from = values.from;
      row.inputDate = existing?.inputDate || now;
      row.updated = now;
    } else if (path === '/recyclables/recyclable-company-records' || path === '/haulers/hauler-records') {
      row.status = existing?.status || 'Active';
      row.updated = now;
    } else if (path === '/recyclables/recyclable-vehicles-records') {
      row.status = values.status || 'Enabled';
      row.updated = now;
    } else if (path === '/haulers/hauler-vehicle-records') {
      row.status = values.status || 'Available';
      row.updated = now;
    } else if (path === '/recyclables/recyclable-waste-items') {
      row.name = values.name;
      row.created = existing?.created || now;
      row.updated = now;
    }
    return row;
  }

  function saveRecord(values: Record<string, string | number>) {
    const page = definition.value;
    if (!page) return;
    const path = pagePath;
    const existing = editingRecord.value;
    const next = makeRow(values, existing);
    const current = [...(recordStore.value[path] || [])];
    const index = current.findIndex((record) => record.id === next.id);
    if (index >= 0) current.splice(index, 1, next);
    else current.unshift(next);
    recordStore.value[path] = current;
    modalOpen.value = false;
    editingRecord.value = null;
    showToast(existing ? 'Record updated' : 'Record added');
  }

  function confirmDelete() {
    const page = definition.value;
    if (!page || !pendingDelete.value) return;
    recordStore.value[pagePath] = rows.value.filter((record) => record.id !== pendingDelete.value!.id);
    pendingDelete.value = null;
    showToast('Record removed from this demo');
  }

  function markDeparted(record: RecordRow) {
    if (record.departureAt) return;
    const departedAt = localDateTimeNow();
    recordStore.value[pagePath] = rows.value.map((item) => item.id === record.id ? {
      ...item,
      departureAt: departedAt,
      departure: `${dateLabel(departedAt)} · ${timeLabel(departedAt)}`,
      status: 'Completed',
      updated: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
    } : item);
    showToast(`Departure recorded at ${timeLabel(departedAt)}`);
  }

  function editSelectedRecord() {
    if (!previewRecord.value) return;
    const selected = previewRecord.value;
    previewRecord.value = null;
    openEdit(selected);
  }

  function deleteSelectedRecord() {
    if (!previewRecord.value) return;
    pendingDelete.value = previewRecord.value;
    previewRecord.value = null;
  }

  function showToast(message: string) {
    toast.value = message;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.value = ''; }, 2600);
  }

  function exportCsv() {
    if (!definition.value) return;
    const cols = definition.value.columns;
    const csv = [cols.map((column) => column.label), ...filteredRows.value.map((record) => cols.map((column) => String(record[column.key] ?? '')))]
      .map((cells) => cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${pagePath.split('/').filter(Boolean).join('-') || 'records'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('Report downloaded');
  }

  function sortColumn(key: string) {
    if (sortBy.value === key) sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
    else { sortBy.value = key; sortDirection.value = 'asc'; }
  }

  function statusClass(value: unknown) {
    const status = String(value || '').toLowerCase();
    if (/pending|return|no departure/.test(status)) return 'status-blue';
    if (/arrived/.test(status)) return 'status-amber';
    if (/repair|partial|draft/.test(status)) return 'status-amber';
    if (/inactive|unavailable|disabled/.test(status)) return 'status-red';
    if (/complete|active|available|enabled|on duty/.test(status)) return '';
    return 'status-neutral';
  }

  function cellClass(key: string) {
    return ['name', 'company', 'plate', 'site', 'material'].includes(key) ? 'cell-primary' : '';
  }
  return {
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
  };
}
