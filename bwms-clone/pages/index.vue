<script setup lang="ts">
import AppShell from '~/components/AppShell.vue';

useHead({ title: 'Summary of Data · Baguio Waste Management System' });

const sourceFilter = ref('All Sources');
const typeFilter = ref('All Waste Types');
const directionFilter = ref('All Directions');
const trendPeriod = ref('Quarterly');
const showGso = ref(true);
const showPrivate = ref(true);
const selectedScheduleDate = ref<number | null>(null);
const calendarMonth = ref(new Date(2026, 9, 1));

const monthLabel = computed(() => calendarMonth.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
const calendarCells = computed(() => {
  const year = calendarMonth.value.getFullYear();
  const month = calendarMonth.value.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array.from({ length: firstDay }, () => null), ...Array.from({ length: days }, (_, index) => index + 1)];
});
const scheduleDays = [7, 14, 21, 28];

const stats = computed(() => {
  const factor = sourceFilter.value === 'All Sources' ? 1 : sourceFilter.value === 'Barangays' ? 0.61 : 0.39;
  const inbound = directionFilter.value === 'Outbound' ? '—' : `${(97.6 * factor).toFixed(1)}K`;
  const residual = directionFilter.value === 'Inbound' ? '—' : `${(108.1 * factor).toFixed(1)}K`;
  const recyclable = directionFilter.value === 'Inbound' ? '—' : `${(1.55 * factor).toFixed(2)}K`;
  return [
    { label: 'Total Outbound Residual Waste', context: 'GSO Data · Jan 2025 to present', value: `${residual} tons`, color: '' },
    { label: 'Total Outbound Residual Waste', context: 'Private company weight bills', value: `${(8.65 * factor).toFixed(2)}K tons`, color: 'amber' },
    { label: 'Total Outbound Recyclable Waste', context: 'Jan 2025 to present', value: `${recyclable} tons`, color: 'blue' },
    { label: 'Total Inbound Solid Waste', context: 'Jan 2025 to present', value: `${inbound} tons`, color: 'purple' },
  ];
});

function moveMonth(amount: number) {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + amount, 1);
  selectedScheduleDate.value = null;
}

function downloadSummary() {
  const rows = [
    ['Metric', 'Value'],
    ...stats.value.map((item) => [item.label, item.value]),
    ['Report period', 'January 2025 to present'],
    ['Workspace', 'Local demonstration data'],
  ];
  const content = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'baguio-waste-dashboard-summary.csv';
  link.click();
  URL.revokeObjectURL(link.href);
}
</script>

<template>
  <AppShell>
    <div class="page-heading dashboard-heading">
      <div><h1>ECOSWIMS Dashboard Summary</h1><p>Monitor waste collection and movement across the city.</p></div>
      <div class="heading-actions"><button class="button button-primary" @click="downloadSummary"><span class="button-icon">⇩</span> Download Report</button></div>
    </div>

    <section class="dashboard-intro">
      <h2>About this dashboard</h2>
      <p>The ECOSWIMS Dashboard provides aggregated information on <strong>solid waste</strong> received and recorded at Baguio City's waste facility. It supports monitoring and analysis of waste collection, waste volume, and the movement of sorted waste materials. Records include collection date, waste source, truck movement times, vehicle weight measurements, and inbound and outbound waste.</p>
      <p><strong>Data are available from January 2025 to present.</strong> Weight records represent transactions recorded in the ECOSWIMS system and should not be interpreted as the total volume of waste generated in Baguio City. Inbound and outbound records reflect movements recorded at the City's facility and may differ due to sorting, recovery, and disposal processes.</p>
      <div class="dashboard-note"><h3>Note</h3><div><b>Inbound</b> = waste coming into the city's dumpsite. <b>Outbound</b> = sorted waste leaving the dumpsite for disposal or recycling.</div></div>
    </section>

    <section class="kpi-grid" aria-label="Summary totals">
      <article v-for="stat in stats" :key="stat.context" class="kpi-card">
        <div class="kpi-label">{{ stat.label }}</div>
        <div class="kpi-number">{{ stat.value }}</div>
        <div class="kpi-foot"><span class="kpi-accent" :class="stat.color" />{{ stat.context }}</div>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="dashboard-panel">
        <div class="panel-heading"><div><h2>Outbound Residual Waste Trend</h2><p>Recorded disposal weight by period</p></div><select v-model="trendPeriod" class="chart-period" aria-label="Trend period"><option>Quarterly</option><option>Monthly</option></select></div>
        <div class="chart-area">
          <svg class="chart-svg" viewBox="0 0 520 190" role="img" aria-label="Bar chart of outbound residual waste trend">
            <g v-for="(tick, index) in [25,20,15,10,5,0]" :key="tick"><line class="chart-grid-line" x1="47" :y1="16 + index * 27" x2="510" :y2="16 + index * 27"/><text class="chart-axis" x="3" :y="19 + index * 27">{{ tick }}t</text></g>
            <g v-for="(label, index) in ['Q4 24','Q1 25','Q2 25','Q3 25','Q4 25','Q1 26','Q2 26','Q3 26','Q4 26']" :key="label">
              <text class="chart-axis" :x="57 + index * 50" y="184">{{ label }}</text>
              <rect v-if="showGso" class="chart-bar" :x="60 + index * 50" :y="147 - ((index * 17 + 31) % 100)" width="13" :height="((index * 17 + 31) % 100)" rx="2"/>
              <rect v-if="showPrivate" class="chart-bar alt" :x="76 + index * 50" :y="147 - ((index * 9 + 19) % 55)" width="10" :height="((index * 9 + 19) % 55)" rx="2"/>
            </g>
          </svg>
        </div>
        <div class="chart-legend"><button class="legend-item legend-toggle" :aria-pressed="showGso" @click="showGso = !showGso"><span class="legend-dot" /> GSO Data</button><button class="legend-item legend-toggle" :aria-pressed="showPrivate" @click="showPrivate = !showPrivate"><span class="legend-dot amber" /> Private Company</button></div>
      </article>

      <article class="dashboard-panel">
        <div class="panel-heading"><div><h2>Outbound Recyclable Waste Trend</h2><p>Weight recovered for recycling</p></div><span class="chart-period">{{ trendPeriod }}</span></div>
        <div class="chart-area">
          <svg class="chart-svg" viewBox="0 0 520 190" role="img" aria-label="Bar chart of recyclable waste trend">
            <g v-for="(tick, index) in [2,1.5,1,.5,0]" :key="tick"><line class="chart-grid-line" x1="47" :y1="18 + index * 33" x2="510" :y2="18 + index * 33"/><text class="chart-axis" x="4" :y="21 + index * 33">{{ tick }}t</text></g>
            <g v-for="(label, index) in ['Q4 24','Q1 25','Q2 25','Q3 25','Q4 25','Q1 26','Q2 26','Q3 26','Q4 26']" :key="label"><text class="chart-axis" :x="57 + index * 50" y="184">{{ label }}</text><rect class="chart-bar" :x="67 + index * 50" :y="147 - ((index * 19 + 18) % 106)" width="20" :height="((index * 19 + 18) % 106)" rx="2"/></g>
          </svg>
        </div>
        <div class="chart-legend"><span class="legend-item"><i class="legend-dot" /> Outbound Recyclable Waste</span></div>
      </article>
    </section>

    <section class="dashboard-filters" aria-label="Dashboard filters">
      <label class="filter-field">Date Collected<input type="date" value="" aria-label="Filter by collection date" /></label>
      <label class="filter-field">Waste Source<select v-model="sourceFilter"><option>All Sources</option><option>Barangays</option><option>Central Business District</option></select></label>
      <label class="filter-field">Waste Type<select v-model="typeFilter"><option>All Waste Types</option><option>Residual Waste</option><option>Recyclable Waste</option></select></label>
      <label class="filter-field">Waste Direction<select v-model="directionFilter"><option>All Directions</option><option>Inbound</option><option>Outbound</option></select></label>
      <button class="button button-quiet filter-clear" @click="sourceFilter = 'All Sources'; typeFilter = 'All Waste Types'; directionFilter = 'All Directions'">Clear Filter</button>
    </section>

    <section class="mini-stat-grid">
      <div class="mini-stat"><span>Inbound Solid Waste</span><strong>{{ directionFilter === 'Outbound' ? 'No data' : '22 tons' }}</strong></div>
      <div class="mini-stat"><span>Outbound Residual Waste</span><strong>{{ directionFilter === 'Inbound' ? 'No data' : '17 tons' }}</strong></div>
      <div class="mini-stat"><span>Outbound Recyclable Waste</span><strong>{{ directionFilter === 'Inbound' ? 'No data' : '5 tons' }}</strong></div>
    </section>

    <section class="dashboard-grid">
      <article class="dashboard-panel">
        <div class="panel-heading"><div><h2>Outbound Solid Waste Distribution</h2><p>Share of outbound waste in current period</p></div></div>
        <div class="donut-wrap"><div class="donut-chart"><div class="donut-hole"><strong>100%</strong><span>Outbound</span></div></div><div class="donut-legend"><span class="legend-item"><i class="legend-dot" /> Residual Waste <b>68%</b></span><span class="legend-item"><i class="legend-dot amber" /> Recyclable Waste <b>32%</b></span></div></div>
      </article>
      <article class="dashboard-panel">
        <div class="panel-heading"><div><h2>Inbound Waste Type Trend</h2><p>Inbound solid waste by month</p></div><span class="chart-period">October 2026</span></div>
        <div class="chart-area">
          <svg class="chart-svg" viewBox="0 0 520 190" role="img" aria-label="Line chart of inbound waste type trend">
            <g v-for="(tick, index) in [10,8,6,4,2,0]" :key="tick"><line class="chart-grid-line" x1="45" :y1="15 + index * 29" x2="510" :y2="15 + index * 29"/><text class="chart-axis" x="6" :y="18 + index * 29">{{ tick }}t</text></g>
            <polyline class="chart-line" points="52,135 110,122 168,128 226,99 284,108 342,79 400,86 458,45 500,57"/>
            <circle v-for="point in [[52,135],[110,122],[168,128],[226,99],[284,108],[342,79],[400,86],[458,45],[500,57]]" :key="point[0]" class="chart-dot" :cx="point[0]" :cy="point[1]" r="3" />
            <g v-for="(day, index) in ['1','5','10','15','20','25','30']" :key="day"><text class="chart-axis" :x="51 + index * 72" y="183">{{ day }}</text></g>
          </svg>
        </div><div class="chart-legend"><span class="legend-item"><i class="legend-dot blue" /> Inbound Solid Waste</span></div>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="dashboard-panel">
        <div class="panel-heading"><div><h2>Outbound Waste Type Trend</h2><p>Residual and recyclable weight</p></div><span class="chart-period">October 2026</span></div>
        <div class="chart-area"><svg class="chart-svg" viewBox="0 0 520 190" role="img" aria-label="Outbound waste trend line chart"><g v-for="(tick, index) in [5,4,3,2,1,0]" :key="tick"><line class="chart-grid-line" x1="45" :y1="15 + index * 29" x2="510" :y2="15 + index * 29"/><text class="chart-axis" x="6" :y="18 + index * 29">{{ tick }}t</text></g><polyline class="chart-line" points="52,139 110,130 168,141 226,107 284,121 342,91 400,96 458,58 500,66"/><polyline class="chart-line-secondary" points="52,163 110,155 168,160 226,149 284,151 342,143 400,147 458,136 500,140"/><text class="chart-axis" x="54" y="183">1</text><text class="chart-axis" x="162" y="183">10</text><text class="chart-axis" x="270" y="183">20</text><text class="chart-axis" x="480" y="183">30</text></svg></div>
        <div class="chart-legend"><span class="legend-item"><i class="legend-dot blue" /> Residual Waste</span><span class="legend-item"><i class="legend-dot" /> Recyclable Waste</span></div>
      </article>
      <article class="dashboard-panel">
        <div class="panel-heading"><div><h2>Outbound Recyclable Material Distribution</h2><p>Weight by material type</p></div></div>
        <div class="chart-area"><svg class="chart-svg" viewBox="0 0 520 190" role="img" aria-label="Recyclable material distribution chart"><g v-for="(tick, index) in [2,1.5,1,.5,0]" :key="tick"><line class="chart-grid-line" x1="45" :y1="16 + index * 33" x2="510" :y2="16 + index * 33"/><text class="chart-axis" x="5" :y="19 + index * 33">{{ tick }}</text></g><rect class="chart-bar" x="100" y="73" width="46" height="74" rx="3"/><rect class="chart-bar alt" x="175" y="110" width="46" height="37" rx="3"/><rect class="chart-bar" x="250" y="126" width="46" height="21" rx="3"/><rect class="chart-bar alt" x="325" y="133" width="46" height="14" rx="3"/><rect class="chart-bar" x="400" y="139" width="46" height="8" rx="3"/><text class="chart-axis" x="103" y="166">Paper</text><text class="chart-axis" x="178" y="166">Metal</text><text class="chart-axis" x="253" y="166">Plastic</text><text class="chart-axis" x="328" y="166">Glass</text><text class="chart-axis" x="403" y="166">Other</text></svg></div>
        <div class="chart-legend"><span class="legend-item"><i class="legend-dot" /> Weight in tons</span></div>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="dashboard-panel">
        <div class="panel-heading"><div><h2>LGU Garbage Trucks Collection Trips</h2><p>Trip count by truck plate number</p></div><span class="chart-period">Page 1 of 3</span></div>
        <div class="truck-chart"><div v-for="(bar, index) in [74,55,81,47,67,38,59,44]" :key="index" class="truck-bar-wrap"><i class="truck-bar" :style="{height: `${bar}%`}"/><span>{{ ['BGU4210','BGU4211','BGU4212','BGU4213','BGU4214','BGU4215','BGU4216','BGU4217'][index] }}</span></div></div><p class="truck-legend">Trip Count · Selected reporting period</p>
      </article>
      <article class="dashboard-panel">
        <div class="calendar-head"><h2>Barangay Waste Collection Schedule</h2><div class="calendar-month"><button aria-label="Previous month" @click="moveMonth(-1)">‹</button><span>{{ monthLabel }}</span><button aria-label="Next month" @click="moveMonth(1)">›</button></div></div>
        <div class="calendar-grid"><span v-for="day in ['SUN','MON','TUE','WED','THU','FRI','SAT']" :key="day" class="calendar-day">{{ day }}</span><template v-for="(date, index) in calendarCells" :key="`day-${index}`"><span v-if="!date" class="calendar-date calendar-empty"/><button v-else class="calendar-date" :class="{ scheduled: scheduleDays.includes(date), 'selected-date': selectedScheduleDate === date }" @click="selectedScheduleDate = date">{{ date }}</button></template></div>
        <p class="dashboard-footer-note">{{ selectedScheduleDate ? `Showing collection schedule for ${monthLabel.split(' ')[0]} ${selectedScheduleDate}.` : 'Green markers indicate published city collection schedules.' }} <NuxtLink to="/waste-collection-schedules" class="inline-link">View all schedules →</NuxtLink></p>
      </article>
    </section>
  </AppShell>
</template>

<style scoped>
.dashboard-heading { align-items: center; }
.dashboard-heading h1 { font-size: clamp(21px, 2vw, 26px); }
.dashboard-intro h2 { margin: 0 0 8px; font-size: 15px; }
.legend-toggle { padding: 0; border: 0; color: inherit; background: transparent; cursor: pointer; }
.legend-toggle[aria-pressed="false"] { opacity: .4; }
.selected-date { border-color: #63cd88 !important; box-shadow: inset 0 0 0 1px #63cd8855; }
.calendar-empty { background: transparent; }
.inline-link { color: #74d694; white-space: nowrap; }
.inline-link:hover { text-decoration: underline; }
@media (max-width: 760px) { .dashboard-heading { align-items: stretch; } }
</style>
