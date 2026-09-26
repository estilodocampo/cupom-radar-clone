// Service worker mínimo: só repasse (sem cache) para habilitar a instalação do PWA
// sem risco de servir conteúdo desatualizado do painel.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
