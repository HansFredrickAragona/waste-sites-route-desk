export default defineNuxtConfig({
  devtools: { enabled: false },
  devServer: { host: '127.0.0.1', port: 3000 },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Baguio Waste Management System',
      meta: [
        { name: 'description', content: 'Baguio City waste management dashboard and records.' },
        { name: 'theme-color', content: '#17191d' },
      ],
    },
  },
  typescript: { strict: true },
});
