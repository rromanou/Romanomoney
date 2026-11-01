/* Page isolée (sandbox) : reçoit le code de la coquille et l'exécute ; l'API chrome n'est qu'un pont limité. */
(() => {
  let seq = 0; const pend = new Map(), changeL = [];
  const rpc = (m, ...a) => new Promise((res) => { const id = ++seq; pend.set(id, res); parent.postMessage({ t: 'rpc', id, m, a }, '*'); });
  const cbw = (p, cb) => p.then((r) => { if (cb) cb(r); });
  window.chrome = {
    runtime: { id: 'rmn-sandbox', lastError: null, onMessage: { addListener() {} } },
    storage: {
      local: {
        get: (k, cb) => { const p = rpc('storage.get', k); if (cb) cbw(p, cb); else return p; },
        set: (o, cb) => { const p = rpc('storage.set', o); if (cb) cbw(p, cb); else return p; },
      },
      onChanged: { addListener: (fn) => changeL.push(fn) },
    },
    tabs: {
      query: (q, cb) => cbw(rpc('tabs.query', q), cb),
      sendMessage: (id, msg, cb) => { const i = ++seq; pend.set(i, (v, err) => { window.chrome.runtime.lastError = err ? { message: err } : null; cb && cb(v); window.chrome.runtime.lastError = null; }); parent.postMessage({ t: 'rpc', id: i, m: 'tabs.sendMessage', a: [id, msg] }, '*'); },
    },
  };
  addEventListener('message', (e) => {
    if (e.source !== parent) return; const d = e.data || {};
    if (d.t === 'rpc-res') { const f = pend.get(d.id); if (f) { pend.delete(d.id); f(d.v, d.err); } }
    else if (d.t === 'storage-changed') changeL.forEach((fn) => { try { fn(d.ch, d.area); } catch (x) { /* ignore */ } });
    else if (d.t === 'boot') boot(d.files);
  });
  function boot(files) {
    let html = files['app.html'];
    html = html.replace(/<link[^>]*href="popup\.css"[^>]*>/, () => '<style>' + files['popup.css'] + '</style>');
    html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (m, n) => files[n] != null ? '<script>' + files[n].replace(/<\/script/gi, '<\\/script') + '<\/script>' : '');
    document.open(); document.write(html); document.close();
    const sz = () => { const r = document.body.getBoundingClientRect(); parent.postMessage({ t: 'size', w: Math.ceil(r.width), h: Math.ceil(r.height) }, '*'); };
    setTimeout(sz, 0); new MutationObserver(sz).observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
  }
  parent.postMessage({ t: 'hello' }, '*');
})();
