// ─── notif.js ──────────────────────────────────────────────────────────────
// Módulo compartido de notificaciones (campanita + sonido) usado tanto por
// index.html (shell de gráficos) como por news.html (noticias). Se guarda en
// localStorage para que activar/desactivar en una pestaña se refleje en la
// otra al instante (evento 'storage').
(function(window){
  'use strict';
  const KEY = 'hlchart:notif:settings';
  const UNREAD_KEY = 'hlchart:news:unread';

  function getSettings(){
    let s = {enabled:false, sound:true};
    try{ s = Object.assign(s, JSON.parse(localStorage.getItem(KEY)||'{}')); }catch(e){}
    return s;
  }
  function saveSettings(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){} }

  // Sonido sintetizado con Web Audio API (sin archivos externos que alojar).
  // Los navegadores bloquean el audio hasta que hay una interacción del
  // usuario en la página; por eso el botón "Probar sonido" es útil para
  // "despertar" el audio la primera vez.
  function playChime(){
    try{
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if(!Ctx) return;
      const ctx = new Ctx();
      const resume = ctx.resume ? ctx.resume() : Promise.resolve();
      resume.then(()=>{
        const now = ctx.currentTime;
        [660, 880].forEach((freq,i)=>{
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const t0 = now + i*0.14;
          gain.gain.setValueAtTime(0, t0);
          gain.gain.linearRampToValueAtTime(0.22, t0+0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, t0+0.35);
          osc.connect(gain); gain.connect(ctx.destination);
          osc.start(t0); osc.stop(t0+0.4);
        });
      });
      setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, 1000);
    }catch(e){}
  }

  async function enableNotifications(){
    if(!('Notification' in window)) return false;
    let perm = Notification.permission;
    if(perm==='default') perm = await Notification.requestPermission();
    const ok = perm==='granted';
    const s=getSettings(); s.enabled=ok; saveSettings(s);
    return ok;
  }
  function disableNotifications(){ const s=getSettings(); s.enabled=false; saveSettings(s); }

  // Dispara sonido + notificación del navegador (si están activados).
  function notify(title, body, onClick){
    const s=getSettings();
    if(s.sound) playChime();
    if(s.enabled && 'Notification' in window && Notification.permission==='granted'){
      try{
        const n = new Notification(title, {body});
        n.onclick=()=>{ try{ window.focus(); }catch(e){} if(onClick) onClick(); n.close(); };
      }catch(e){}
    }
  }

  // ─── Badge de "no leídas" para el botón de Noticias en el shell ───────────
  function getUnread(){ return parseInt(localStorage.getItem(UNREAD_KEY)||'0',10)||0; }
  function bumpUnread(n){ try{ localStorage.setItem(UNREAD_KEY, String(getUnread()+n)); }catch(e){} }
  function clearUnread(){ try{ localStorage.setItem(UNREAD_KEY, '0'); }catch(e){} }

  // ─── UI: botón campana + panel de ajustes (se inyecta en cualquier página) ─
  function injectStyle(){
    if(document.getElementById('hlnotif-style')) return;
    const st=document.createElement('style');
    st.id='hlnotif-style';
    st.textContent = `
.hlnotif-wrap{position:relative;display:inline-flex}
.hlnotif-btn{position:relative;display:flex;align-items:center;gap:5px;background:var(--bg4,#1a1e2a);
  border:1px solid var(--border2,#262c3d);border-radius:8px;padding:6px 10px;cursor:pointer;
  font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:700;color:var(--text,#e2e8f4);transition:all .15s}
.hlnotif-btn:hover{border-color:var(--accent2,#7c8cf8);color:var(--accent2,#7c8cf8)}
.hlnotif-btn.on{color:var(--green,#00e5a0);border-color:rgba(0,229,160,.5)}
.hlnotif-dot{width:7px;height:7px;border-radius:50%;background:var(--red,#ff4466);position:absolute;top:3px;right:3px;display:none}
.hlnotif-dot.show{display:block}
.hlnotif-panel{display:none;position:absolute;top:calc(100% + 6px);right:0;width:236px;
  background:var(--bg2,#0e1018);border:1px solid var(--border2,#262c3d);border-radius:10px;padding:12px;
  z-index:300;box-shadow:0 16px 40px rgba(0,0,0,.6);font-family:Inter,sans-serif}
.hlnotif-panel.open{display:block}
.hlnotif-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:8px}
.hlnotif-row:last-child{margin-bottom:0}
.hlnotif-label{font-size:11px;color:var(--text,#e2e8f4)}
.hlnotif-toggle{position:relative;width:32px;height:18px;border-radius:10px;background:var(--bg4,#1a1e2a);
  border:1px solid var(--border2,#262c3d);cursor:pointer;flex-shrink:0;transition:all .15s}
.hlnotif-toggle::after{content:'';position:absolute;width:12px;height:12px;border-radius:50%;
  background:var(--muted,#5a6278);top:2px;left:2px;transition:all .15s}
.hlnotif-toggle.on{background:rgba(91,110,245,.25);border-color:var(--accent,#5b6ef5)}
.hlnotif-toggle.on::after{left:16px;background:var(--accent2,#7c8cf8)}
.hlnotif-test{width:100%;padding:7px;border-radius:6px;background:var(--accent,#5b6ef5);border:none;
  color:#fff;font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:700;cursor:pointer;margin-top:2px;transition:background .15s}
.hlnotif-test:hover{background:var(--accent2,#7c8cf8)}
.hlnotif-note{font-size:9px;color:var(--muted,#5a6278);line-height:1.45;margin-top:9px}
`;
    document.head.appendChild(st);
  }

  function buildBell(container){
    injectStyle();
    const wrap=document.createElement('div');
    wrap.className='hlnotif-wrap';
    wrap.innerHTML=
      '<button class="hlnotif-btn" id="hlnotif-btn" title="Ajustes de notificaciones">🔔<span class="hlnotif-dot" id="hlnotif-dot"></span></button>'+
      '<div class="hlnotif-panel" id="hlnotif-panel">'+
        '<div class="hlnotif-row"><span class="hlnotif-label">Notificaciones</span><div class="hlnotif-toggle" id="hlnotif-t-enabled"></div></div>'+
        '<div class="hlnotif-row"><span class="hlnotif-label">Sonido</span><div class="hlnotif-toggle" id="hlnotif-t-sound"></div></div>'+
        '<button class="hlnotif-test" id="hlnotif-test">🔊 Probar sonido</button>'+
        '<div class="hlnotif-note">Avisa con sonido y notificación del navegador cuando aparecen noticias nuevas en la pestaña de Noticias.</div>'+
      '</div>';
    container.appendChild(wrap);
    const btn=wrap.querySelector('#hlnotif-btn');
    const dot=wrap.querySelector('#hlnotif-dot');
    const panel=wrap.querySelector('#hlnotif-panel');
    const tEnabled=wrap.querySelector('#hlnotif-t-enabled');
    const tSound=wrap.querySelector('#hlnotif-t-sound');
    function refresh(){
      const s=getSettings();
      tEnabled.classList.toggle('on', !!s.enabled);
      tSound.classList.toggle('on', !!s.sound);
      btn.classList.toggle('on', !!s.enabled);
    }
    refresh();
    btn.addEventListener('click', e=>{ e.stopPropagation(); panel.classList.toggle('open'); });
    document.addEventListener('click', e=>{ if(!wrap.contains(e.target)) panel.classList.remove('open'); });
    tEnabled.addEventListener('click', async ()=>{
      const s=getSettings();
      if(!s.enabled){
        const ok=await enableNotifications();
        if(!ok) alert('Para activarlas, permite las notificaciones cuando el navegador lo pida (o revisa los permisos del sitio).');
      } else disableNotifications();
      refresh();
    });
    tSound.addEventListener('click', ()=>{ const s=getSettings(); s.sound=!s.sound; saveSettings(s); refresh(); });
    wrap.querySelector('#hlnotif-test').addEventListener('click', ()=>playChime());
    window.addEventListener('storage', e=>{ if(e.key===KEY) refresh(); });
    return {refresh};
  }

  function bindUnreadDot(dotEl){
    function refresh(){ dotEl.classList.toggle('show', getUnread()>0); }
    refresh();
    window.addEventListener('storage', e=>{ if(e.key===UNREAD_KEY) refresh(); });
    return {refresh};
  }

  window.HLNotif = {
    getSettings, saveSettings, playChime, notify,
    enableNotifications, disableNotifications,
    getUnread, bumpUnread, clearUnread,
    buildBell, bindUnreadDot,
  };
})(window);
