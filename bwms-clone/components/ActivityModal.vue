<script setup lang="ts">
defineEmits<{ close: [] }>();
const events = [
  { action: 'Record updated', detail: 'Collection record · Local demo', time: 'Today, 10:42 AM', initials: 'TT' },
  { action: 'Schedule published', detail: 'Central District Rotation', time: 'Today, 9:16 AM', initials: 'TT' },
  { action: 'Vehicle status changed', detail: 'BGU 4212 · Under repair', time: 'Yesterday, 3:08 PM', initials: 'TT' },
];
</script>

<template>
  <div class="modal-backdrop" @click.self="$emit('close')">
    <section class="activity-modal" role="dialog" aria-modal="true" aria-label="Activity logs">
      <header class="modal-header">
        <div><span class="eyebrow">Workspace history</span><h2>Activity Logs</h2><p>Recent changes in this demo workspace</p></div>
        <button class="modal-close" aria-label="Close dialog" @click="$emit('close')">×</button>
      </header>
      <ol class="activity-list">
        <li v-for="event in events" :key="event.action" class="activity-item">
          <span class="activity-avatar">{{ event.initials }}</span>
          <div><strong>{{ event.action }}</strong><p>{{ event.detail }}</p><small>{{ event.time }}</small></div>
        </li>
      </ol>
      <div class="modal-actions"><button class="button button-quiet" @click="$emit('close')">Close</button></div>
    </section>
  </div>
</template>
