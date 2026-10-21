<script setup lang="ts">
import type { PageDefinition, RecordRow } from '~/data/pages';

type VehicleOption = { plate: string; driver: string; tare: string };
const props = defineProps<{
  definition: PageDefinition;
  initial?: RecordRow | null;
  actionTitle?: string;
  vehicles?: VehicleOption[];
  sites?: string[];
}>();
const emit = defineEmits<{ close: []; save: [Record<string, string | number>] }>();

const values = reactive<Record<string, string | number>>({});
const selectedSites = ref<string[]>([]);
const isEditing = computed(() => Boolean(props.initial));
const isWasteReport = computed(() => props.definition.path === '/lgu/management-records');
const selectedVehicle = computed(() => (props.vehicles || []).find((vehicle) => vehicle.plate === String(values.plate || '')));

function resetValues() {
  for (const key of Object.keys(values)) delete values[key];
  for (const field of props.definition.fields) {
    const existing = props.initial?.[field.key];
    values[field.key] = existing === undefined ? '' : existing;
  }
  if (isWasteReport.value) values.driver = props.initial?.driver || selectedVehicle.value?.driver || '';
  selectedSites.value = String(props.initial?.sourceSites || '').split(',').map((site) => site.trim()).filter(Boolean);
}

watch(() => [props.initial, props.definition.path], resetValues, { immediate: true });
watch(() => values.plate, () => {
  if (!isWasteReport.value || !selectedVehicle.value) return;
  values.driver = selectedVehicle.value.driver;
  values.tare = selectedVehicle.value.tare;
});
function submitForm() {
  emit('save', { ...values, sourceSites: selectedSites.value.join(', ') });
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <section class="record-modal" role="dialog" aria-modal="true" :aria-label="actionTitle || definition.addLabel">
      <header class="modal-header">
        <div>
          <span class="eyebrow">{{ definition.section }}</span>
          <h2>{{ actionTitle || (isEditing ? `Edit ${definition.heading}` : definition.addLabel) }}</h2>
          <p>{{ isEditing ? 'Update the record details below.' : 'Enter the arrival details for this truck.' }}</p>
        </div>
        <button class="modal-close" aria-label="Close dialog" @click="emit('close')">×</button>
      </header>
      <form @submit.prevent="submitForm">
        <div v-if="isWasteReport" class="form-grid">
          <label class="form-field">
            <span>Plate Number<b>*</b></span>
            <select v-model="values.plate" required>
              <option value="" disabled>Select plate number</option>
              <option v-for="vehicle in vehicles" :key="vehicle.plate" :value="vehicle.plate">{{ vehicle.plate }}</option>
            </select>
          </label>
          <label class="form-field">
            <span>Truck Weight (kg)<b>*</b></span>
            <input v-model="values.gross" type="number" min="0" step="any" required placeholder="Enter loaded weight" />
          </label>
          <label class="form-field">
            <span>Assigned Driver</span>
            <input v-model="values.driver" type="text" :placeholder="selectedVehicle ? '' : 'Select a plate to fill driver'" />
          </label>
          <label class="form-field">
            <span>Vehicle Tare Weight</span>
            <input :value="selectedVehicle?.tare || values.tare || 'Select a plate to fill tare weight'" type="text" readonly class="read-only-field" />
          </label>
          <fieldset class="form-field field-wide site-picker">
            <legend>Collection Sites</legend>
            <p>Optional. Choose every site where this truck collected waste.</p>
            <div class="site-choice-grid">
              <label v-for="site in sites" :key="site" class="site-choice"><input v-model="selectedSites" type="checkbox" :value="site" /><span>{{ site }}</span></label>
            </div>
          </fieldset>
          <template v-if="isEditing">
            <label class="form-field"><span>Arrival Date &amp; Time<b>*</b></span><input v-model="values.arrivedAt" type="datetime-local" required /></label>
            <label class="form-field"><span>Departure Date &amp; Time</span><input v-model="values.departureAt" type="datetime-local" /></label>
            <label class="form-field"><span>Status<b>*</b></span><select v-model="values.status" required><option>Arrived</option><option>Pending Departure</option><option>Completed</option></select></label>
          </template>
          <p v-else class="form-note field-wide">Arrival date and time are recorded automatically when you save. The departure time is recorded with one click from the report row.</p>
        </div>

        <div v-else class="form-grid">
          <label v-for="field in definition.fields" :key="field.key" class="form-field" :class="{ 'field-wide': field.wide || field.type === 'textarea' }">
            <span>{{ field.label }}<b v-if="field.required">*</b></span>
            <select v-if="field.type === 'select'" v-model="values[field.key]" :required="field.required">
              <option value="" disabled>Select {{ field.label.toLowerCase() }}</option>
              <option v-for="option in field.options" :key="option" :value="option">{{ option }}</option>
            </select>
            <textarea v-else-if="field.type === 'textarea'" v-model="values[field.key]" rows="3" :required="field.required" />
            <input v-else v-model="values[field.key]" :type="field.type || 'text'" :required="field.required" :step="field.type === 'number' ? 'any' : undefined" />
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="button button-quiet" @click="emit('close')">Cancel</button>
          <button type="submit" class="button button-primary">{{ isEditing ? 'Save Changes' : 'Save Record' }}</button>
        </div>
      </form>
    </section>
  </div>
</template>

<style scoped>
.read-only-field { color: var(--muted) !important; opacity: .86; }
.site-picker { min-width: 0; margin: 0; padding: 0; border: 0; }
.site-picker legend { padding: 0; color: #d8dbe1; font-size: 11px; font-weight: 550; }
.site-picker p { margin: -1px 0 7px; color: var(--muted); font-size: 10px; font-weight: 400; }
.site-choice-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 7px; }
.site-choice { display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 5px; color: var(--text); background: var(--surface-soft); font-size: 10px; font-weight: 450; }
.site-choice:has(input:checked) { border-color: #2d7548; background: #173b27; }
.site-choice input { accent-color: var(--green); }
.form-note { margin: 1px 0 0; color: var(--muted); font-size: 10px; }
@media (max-width: 760px) { .site-choice-grid { grid-template-columns: 1fr; } }
</style>
