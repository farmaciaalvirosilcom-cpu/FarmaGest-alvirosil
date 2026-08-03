// ── Registar Service Worker ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log('[FarmaGest] Service Worker registado:', reg.scope);

        // Força uma verificação imediata por uma versão nova (o navegador, por padrão, só
        // verifica a cada ~24h; isto ignora esse limite e verifica sempre que a app abre).
        reg.update().catch(() => {});

        // Escutar mensagens do SW (ex: SYNC_REQUESTED)
        navigator.serviceWorker.addEventListener('message', e => {
          if (e.data?.type === 'SYNC_REQUESTED') {
            console.log('[FarmaGest] Sync solicitado pelo SW');
            if (typeof renderAll === 'function') renderAll();
          }
        });
      })
      .catch(err => console.warn('[FarmaGest] SW falhou:', err));

    // Quando uma versão nova do Service Worker assume o controlo, a página recarrega-se
    // sozinha para garantir que mostra sempre a versão mais recente do código.
    let _swJaRecarregou = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (_swJaRecarregou) return;
      _swJaRecarregou = true;
      window.location.reload();
    });
  });
}

// ── Install Prompt (Android Chrome / Edge PC) ──
let _pwaPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pwaPrompt = e;
  const banner = document.getElementById('pwa-banner');
  if (banner && !localStorage.getItem('pwa_dispensado')) {
    banner.style.display = 'flex';
  }
});

function instalarPWA() {
  if (!_pwaPrompt) return;
  _pwaPrompt.prompt();
  _pwaPrompt.userChoice.then(r => {
    if (r.outcome === 'accepted') {
      console.log('[FarmaGest] PWA instalada');
      fecharBannerPWA();
    }
    _pwaPrompt = null;
  });
}

function fecharBannerPWA() {
  const banner = document.getElementById('pwa-banner');
  if (banner) banner.style.display = 'none';
  localStorage.setItem('pwa_dispensado', '1');
}

window.addEventListener('appinstalled', () => {
  fecharBannerPWA();
  console.log('[FarmaGest] App instalada com sucesso');
});

// ── Pedir permissão para Notificações ──
function pedirPermissaoNotificacoes() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') {
        new Notification('FarmaGest', {
          body: '✅ Notificações activadas! Receberás alertas de stock e validades.',
          icon: 'icon-192.png'
        });
      }
    });
  }
}

// Pedir notificações após login (espera 3s)
const _loginOrigPWA = typeof fazerLogin === 'function' ? fazerLogin : null;
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (Notification.permission === 'default') pedirPermissaoNotificacoes();
  }, 3000);
});
