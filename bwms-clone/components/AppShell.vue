<script setup lang="ts">
import { navigationGroups } from '~/data/pages';

const route = useRoute();
const menuOpen = ref(false);
const profileOpen = ref(false);
const isLight = ref(false);

const currentLabel = computed(() => {
  for (const group of navigationGroups) {
    const active = group.items.find((item) => item.path === route.path);
    if (active) return { section: group.label, label: active.label };
  }
  return { section: 'Overview', label: 'Summary of Data' };
});

function closeNavGroup(event: MouseEvent) {
  const link = event.currentTarget;
  if (link instanceof HTMLElement) {
    const accordion = link.closest('details.nav-accordion');
    if (accordion instanceof HTMLDetailsElement) accordion.open = false;
  }
  menuOpen.value = false;
}

function toggleTheme() {
  isLight.value = !isLight.value;
  if (import.meta.client) localStorage.setItem('bwms-theme', isLight.value ? 'light' : 'dark');
}

onMounted(() => {
  isLight.value = localStorage.getItem('bwms-theme') === 'light';
});
</script>

<template>
  <div class="app-frame" :class="{ 'theme-light': isLight, 'nav-expanded': menuOpen, 'page-biodegradable': route.path === '/biodegradable' }">
    <div v-if="menuOpen" class="mobile-scrim" @click="menuOpen = false" />

    <aside class="sidebar" :class="{ 'sidebar-open': menuOpen }" aria-label="Main navigation">
      <div class="brand-lockup">
        <div class="brand-seal" aria-hidden="true"><span>B</span><i>✦</i></div>
        <div class="brand-copy">
          <strong>eGov:Baguio</strong>
          <span>Waste Management</span>
          <small>TEST ENVIRONMENT</small>
        </div>
        <button class="sidebar-close" aria-label="Close navigation" @click="menuOpen = false">×</button>
      </div>

      <nav class="nav-groups" aria-label="Main pages">
        <section v-for="group in navigationGroups" :key="group.label" class="nav-group">
          <NuxtLink
            v-if="group.items.length === 1"
            :to="group.items[0]!.path"
            class="rail-link"
            :title="group.items[0]!.label"
            :aria-label="group.items[0]!.label"
            :class="{ active: route.path === group.items[0]!.path }"
            @click="menuOpen = false"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="1.8"/><path d="M6.5 16l3.2-3.4 2.5 2.1 4.7-5.2M6.5 8h2"/></svg>
            <span v-if="menuOpen">{{ group.items[0]!.label }}</span>
          </NuxtLink>
          <template v-else-if="group.label === 'Services'">
            <NuxtLink
              v-for="item in group.items"
              :key="item.path"
              :to="item.path"
              class="rail-link service-link"
              :title="item.label"
              :aria-label="item.label"
              :class="{ active: route.path === item.path }"
              @click="menuOpen = false"
            >
              <svg v-if="item.label === 'Collection Schedule'" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="1.7"/><path d="M7.5 3.5v4M16.5 3.5v4M4 9.5h16M15.5 13.5v5M13 16h5"/></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 4.5c-7.2 0-12.1 2.9-12.1 8.2 0 3.4 2.4 5.3 5.4 5.3 5.6 0 6.7-7.5 6.7-13.5Z"/><path d="M4 20c2.3-4.2 5.5-7.1 10.6-9.7"/></svg>
              <span v-if="menuOpen">{{ item.label }}</span>
            </NuxtLink>
          </template>
          <details v-else :open="menuOpen ? true : undefined" class="nav-accordion">
            <summary class="rail-link" :title="group.label" :aria-label="group.label">
              <svg v-if="group.label === 'City Records'" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3.5h9l5 5v8.1a3.9 3.9 0 0 1-3.9 3.9H8.9A3.9 3.9 0 0 1 5 16.6V3.5Z"/><path d="M14 3.8v5h5M8 12h7M8 15h4"/><circle cx="17.5" cy="17.5" r="3"/><path d="M17.5 16v1.7l1.1.7"/></svg>
              <svg v-else-if="group.label === 'Private Hauler'" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v11H3zM14 10h4.2l3 3v4H14z"/><circle cx="7" cy="18" r="1.8"/><circle cx="18" cy="18" r="1.8"/><path d="M14 13h6"/></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 3-1.5 2 3-2 1.8M16 6h3.5L22 10l-2.5 2.5M19 16l-1.5 4-4.5.5-2-2.5M7 18H3l-2-4 2.2-2.7M5 8 3 5l3.5-3h4"/><path d="M8.5 7.5 12 6l3.5 2 2 4-2 4-4 1-4-2-1-4z"/></svg>
              <span v-if="menuOpen">{{ group.label }}</span>
            </summary>
            <div class="nav-flyout">
              <strong>{{ group.label }}</strong>
              <NuxtLink
                v-for="item in group.items"
                :key="item.path"
                :to="item.path"
                class="nav-flyout-link"
                :class="{ active: route.path === item.path }"
                @click="closeNavGroup"
              >{{ item.label }}</NuxtLink>
            </div>
          </details>
        </section>
      </nav>

      <div class="sidebar-foot">
        <span class="status-dot" title="Local demo workspace" aria-label="Local demo workspace" />
      </div>
    </aside>

    <div class="main-layout">
      <header class="topbar">
        <div class="topbar-left">
          <button class="icon-button menu-toggle" aria-label="Toggle navigation" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">☰</button>
        </div>
        <div class="topbar-right">
          <div class="profile-wrap">
            <button class="avatar-button" aria-label="Open user menu" :aria-expanded="profileOpen" @click="profileOpen = !profileOpen">TT</button>
            <div v-if="profileOpen" class="profile-menu">
              <div class="profile-person"><span class="profile-avatar">TT</span><div><strong>Test User</strong><small>Waste Management</small></div></div>
              <button class="profile-action" @click="toggleTheme">{{ isLight ? '☾' : '☼' }} Switch to {{ isLight ? 'dark' : 'light' }} mode</button>
              <div class="profile-note">Signed in to the local demo</div>
            </div>
          </div>
        </div>
      </header>

      <div class="page-context">
        <span v-if="route.path === '/biodegradable'">Manage Biodegradable Records</span>
        <template v-else>
          <span class="context-section">{{ currentLabel.section }}</span>
          <span class="context-separator">/</span>
          <span>{{ currentLabel.label }}</span>
        </template>
        <span v-if="route.path === '/biodegradable'" class="page-context-category"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 4.5c-7.2 0-12.1 2.9-12.1 8.2 0 3.4 2.4 5.3 5.4 5.3 5.6 0 6.7-7.5 6.7-13.5Z"/><path d="M4 20c2.3-4.2 5.5-7.1 10.6-9.7"/></svg>Biodegradable</span>
      </div>
      <main class="main-content">
        <slot />
      </main>
      <footer class="app-footer"><span>eGov:Baguio · Waste Management System</span><span>Test workspace</span></footer>
    </div>
  </div>
</template>
