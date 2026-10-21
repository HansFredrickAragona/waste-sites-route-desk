import { computed, ref, watch, type ComputedRef } from 'vue';
import type { PageDefinition, RecordRow } from '~/data/pages';

type UseRecordFiltersOptions = {
  rows: ComputedRef<RecordRow[]>;
  definition: ComputedRef<PageDefinition | null>;
  isWasteReport: ComputedRef<boolean>;
  siteOptions: ComputedRef<string[]>;
};

export function useRecordFilters({ rows, definition, isWasteReport, siteOptions }: UseRecordFiltersOptions) {
  const search = ref('');
  const statusFilter = ref('All');
  const dateFilter = ref('');
  const dateRangeStart = ref('');
  const dateRangeEnd = ref('');
  const datePickerOpen = ref(false);
  const dateCalendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const sourceFilter = ref('');
  const sourceSearch = ref('');
  const sourceFilterOpen = ref(false);
  const datePresets = [
    { label: 'Today', value: 'today' },
    { label: 'Last 7 days', value: 7 },
    { label: 'Last 14 days', value: 14 },
    { label: 'Last 30 days', value: 30 },
    { label: 'Last 3 months', value: '3months' },
    { label: 'Last 6 months', value: '6months' },
  ] as const;
  const currentPage = ref(1);
  const pageSize = 6;
  const sortBy = ref(definition.value?.path === '/biodegradable' ? 'inputDate' : '');
  const sortDirection = ref<'asc' | 'desc'>(definition.value?.path === '/biodegradable' ? 'desc' : 'asc');
  const statusOptions = computed(() => [...new Set(rows.value.map((record) => String(record.status || '')).filter(Boolean))]);
  const sourceOptions = computed(() => {
    const isBiodegradable = definition.value?.path === '/biodegradable';
    const options = new Set(isBiodegradable ? [] : siteOptions.value);
    for (const record of rows.value) {
      for (const key of isBiodegradable ? ['from'] : ['sourceSites', 'source']) {
        for (const source of String(record[key] || '').split(',').map((item) => item.trim()).filter(Boolean)) options.add(source);
      }
    }
    return [...options].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  });
  const matchingSourceOptions = computed(() => {
    const query = sourceSearch.value.trim().toLowerCase();
    return sourceOptions.value.filter((source) => !query || source.toLowerCase().includes(query));
  });
  const dateColumn = computed(() => definition.value?.columns.find((column) => /date|created|updated/i.test(`${column.label} ${column.key}`))?.key || '');

  function dateToISO(value: unknown) {
    if (!value || value === '—') return '';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? '' : dateKey(date);
  }

  function dateKey(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function dateFromKey(key: string) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function formatDateKey(key: string) {
    return dateFromKey(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatCalendarMonth(month: Date) {
    return month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  const dateCalendarMonths = computed(() => [
    new Date(dateCalendarMonth.value.getFullYear(), dateCalendarMonth.value.getMonth(), 1),
    new Date(dateCalendarMonth.value.getFullYear(), dateCalendarMonth.value.getMonth() + 1, 1),
  ]);
  const dateCalendarHeading = computed(() => `${formatCalendarMonth(dateCalendarMonths.value[0]!)} – ${formatCalendarMonth(dateCalendarMonths.value[1]!)}`);
  const dateFilterLabel = computed(() => {
    if (!dateRangeStart.value) return 'Filter by date';
    if (!dateRangeEnd.value || dateRangeStart.value === dateRangeEnd.value) return formatDateKey(dateRangeStart.value);
    return `${formatDateKey(dateRangeStart.value)} – ${formatDateKey(dateRangeEnd.value)}`;
  });

  function calendarDays(month: Date) {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    return Array.from({ length: 42 }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index - firstDay + 1));
  }

  function dateCellClasses(date: Date, month: Date) {
    const key = dateKey(date);
  return {
    'calendar-outside-month': date.getMonth() !== month.getMonth(),
    'calendar-range-start': key === dateRangeStart.value,
    'calendar-range-end': !!dateRangeEnd.value && key === dateRangeEnd.value,
    'calendar-in-range': !!dateRangeStart.value && !!dateRangeEnd.value && key > dateRangeStart.value && key < dateRangeEnd.value,
  };
}

function shiftDateCalendar(amount: number) {
  dateCalendarMonth.value = new Date(dateCalendarMonth.value.getFullYear(), dateCalendarMonth.value.getMonth() + amount, 1);
}

function selectCalendarDate(date: Date) {
  const selected = dateKey(date);
  if (!dateRangeStart.value || dateRangeEnd.value) {
    dateRangeStart.value = selected;
    dateRangeEnd.value = '';
    return;
  }
  if (selected < dateRangeStart.value) {
    dateRangeEnd.value = dateRangeStart.value;
    dateRangeStart.value = selected;
  } else {
    dateRangeEnd.value = selected;
  }
  datePickerOpen.value = false;
}

function applyDatePreset(days: number | 'today' | '3months' | '6months') {
  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (days === '3months') start.setMonth(start.getMonth() - 3);
  else if (days === '6months') start.setMonth(start.getMonth() - 6);
  else if (days !== 'today') start.setDate(start.getDate() - days + 1);
  dateRangeStart.value = dateKey(start);
  dateRangeEnd.value = dateKey(end);
  dateCalendarMonth.value = new Date(start.getFullYear(), start.getMonth(), 1);
  datePickerOpen.value = false;
}

function clearDateFilter() {
  dateRangeStart.value = '';
  dateRangeEnd.value = '';
}

function selectSource(source: string) {
  sourceFilter.value = sourceFilter.value === source ? '' : source;
  sourceSearch.value = '';
  sourceFilterOpen.value = false;
}

const filteredRows = computed(() => {
  const query = search.value.trim().toLowerCase();
  let filtered = rows.value.filter((record) => {
    const matchesText = !query || Object.values(record).some((value) => String(value ?? '').toLowerCase().includes(query));
    const matchesStatus = isWasteReport.value || statusFilter.value === 'All' || String(record.status) === statusFilter.value;
    const recordDate = dateToISO(record[dateColumn.value]);
    const usesDateRange = isWasteReport.value || definition.value?.path === '/biodegradable';
    const matchesDate = usesDateRange
      ? !dateRangeStart.value || (!!recordDate && recordDate >= dateRangeStart.value && recordDate <= (dateRangeEnd.value || dateRangeStart.value))
      : !dateFilter.value || recordDate === dateFilter.value;
    const isBiodegradable = definition.value?.path === '/biodegradable';
    const recordSources = String(isBiodegradable ? record.from || '' : record.sourceSites || record.source || '').split(',').map((source) => source.trim());
    const hasSourceFilter = isWasteReport.value || isBiodegradable;
    const matchesSource = !hasSourceFilter || !sourceFilter.value || recordSources.includes(sourceFilter.value);
    return matchesText && matchesStatus && matchesDate && matchesSource;
  });
  if (sortBy.value) {
    const key = sortBy.value;
    const direction = sortDirection.value === 'asc' ? 1 : -1;
    filtered = [...filtered].sort((a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''), undefined, { numeric: true }) * direction);
  }
  return filtered;
});

  const totalPages = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / pageSize)));
  const visibleRows = computed(() => filteredRows.value.slice((currentPage.value - 1) * pageSize, currentPage.value * pageSize));
  const visibleStart = computed(() => filteredRows.value.length === 0 ? 0 : (currentPage.value - 1) * pageSize + 1);
  const visibleEnd = computed(() => Math.min(filteredRows.value.length, currentPage.value * pageSize));

  watch([search, statusFilter, dateFilter, dateRangeStart, dateRangeEnd, sourceFilter], () => { currentPage.value = 1; });


  return {
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
  };
}
