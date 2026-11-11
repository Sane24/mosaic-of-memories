/* Mosaic of Memories: interactions. Everything here is progressive; the page
   reads fine without it. Data comes from assets/data.js (built from outputs/). */
(() => {
  const D = window.MOSAIC_DATA;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };

  /* ---------- nav: highlight the section in view */
  const topbar = $('.topbar');
  const links = new Map($$('.topnav a').map(a => [a.getAttribute('href').slice(1), a]));
  if (topbar) topbar.dataset.reel = 'a';
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      // the nav only lists the sections of the reel being read
      const part = e.target.closest('[data-part]');
      if (part && topbar) topbar.dataset.reel = part.dataset.part;
      links.forEach(a => a.classList.remove('is-active'));
      const a = links.get(e.target.id);
      if (a) {
        a.classList.add('is-active');
        // only scroll the nav strip sideways; scrollIntoView on a sticky bar moves the page
        const nav = a.parentElement;
        if (nav.scrollWidth > nav.clientWidth) {
          nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.offsetWidth / 2, behavior: 'smooth' });
        }
      }
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
  $$('.hero, .reelcard').forEach(s => spy.observe(s));

  /* ---------- scroll reveals */
  const revealTargets = $$('.strip, .index-card, .rectify__stage, .loupe, .plate-ex__body, .pano, .shares, .bells, .letter, .filmstrip, .pinned-note, .capture-notes, .prose--two, .funnel, .cornerlab, .tally, .desclab, .histo, .bench, .ransac-grid, .versus__body, .shoebox, .found');
  if (!reduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach(el => { el.classList.add('reveal'); io.observe(el); });
    // printing should never leave anything hidden
    addEventListener('beforeprint', () => revealTargets.forEach(el => el.classList.add('is-in')));
  }


  /* ---------- film counter, reel and gate follow the scroll */
  const root = document.documentElement;
  const counter = $('[data-counter]');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = scrollY, max = Math.max(1, root.scrollHeight - innerHeight);
      root.style.setProperty('--reel', `${y * .4}deg`);
      root.style.setProperty('--gate', `${-y * .5}px`);
      if (counter) counter.textContent = 'FR ' + String(Math.round(y / max * 999)).padStart(3, '0');
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- clapperboard slates on each section */
  const slateIO = 'IntersectionObserver' in window && !reduced
    ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-clapped'); slateIO.unobserve(e.target); } }), { rootMargin: '0px 0px -20% 0px' })
    : null;
  $$('.sec-num').forEach(num => {
    const scene = (num.firstChild.textContent || '').trim();
    if (!/^\d+$/.test(scene)) return;
    const slate = document.createElement('p');
    slate.className = 'slate';
    slate.setAttribute('aria-hidden', 'true');
    const roll = (num.closest('[data-part]')?.dataset.part || 'b').toUpperCase();
    slate.innerHTML = `<span>ROLL<b>${roll}</b></span><span>SCENE<b>${scene}</b></span><span>TAKE<b>1</b></span>`;
    num.before(slate);
    slateIO?.observe(slate);
  });

  const whenReady = fn => fn();

  /* ---------- timecode at 24 fps */
  const tc = $('[data-ro="tc"]');
  if (tc) {
    const start = performance.now();
    const pad = n => String(n).padStart(2, '0');
    setInterval(() => {
      const f = Math.floor((performance.now() - start) / (1000 / 24));
      tc.textContent = `${pad(Math.floor(f / 86400))}:${pad(Math.floor(f / 1440) % 60)}:${pad(Math.floor(f / 24) % 60)}:${pad(f % 24)}`;
    }, 1000 / 24);
  }

  /* ---------- focus ring: drag, scroll or arrow keys to pull focus */
  const dial = $('[data-dial]'), plateEl = $('[data-plate]');
  if (dial && plateEl) {
    const ticks = $('[data-ticks]', dial);
    for (let k = 0; k < 48; k++) {
      const a = k / 48 * 2 * Math.PI, r2 = k % 4 ? 39 : 36;
      ticks.appendChild(svgEl('line', { x1: 60 + 42 * Math.sin(a), y1: 60 - 42 * Math.cos(a), x2: 60 + r2 * Math.sin(a), y2: 60 - r2 * Math.cos(a) }));
    }
    let angle = 0;
    const setAngle = a => {
      angle = Math.max(-150, Math.min(150, a));
      dial.style.setProperty('--ring', `${angle}deg`);
      plateEl.style.setProperty('--defocus', `${(Math.abs(angle) / 150 * 7).toFixed(2)}px`);
      dial.setAttribute('aria-valuenow', Math.round(angle / 1.5));
    };
    let drag = null;
    const angleAt = e => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientX - r.left - r.width / 2, -(e.clientY - r.top - r.height / 2)) * 180 / Math.PI; };
    dial.addEventListener('pointerdown', e => { drag = { from: angleAt(e), base: angle }; dial.setPointerCapture(e.pointerId); });
    dial.addEventListener('pointermove', e => {
      if (!drag) return;
      let d = angleAt(e) - drag.from;
      if (d > 180) d -= 360; if (d < -180) d += 360;
      setAngle(drag.base + d);
    });
    dial.addEventListener('pointerup', () => { drag = null; });
    dial.addEventListener('wheel', e => { e.preventDefault(); setAngle(angle + Math.sign(e.deltaY) * 8); }, { passive: false });
    dial.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { setAngle(angle + 10); e.preventDefault(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { setAngle(angle - 10); e.preventDefault(); }
      if (e.key === 'Home') { setAngle(0); e.preventDefault(); }
    });
    if (!reduced) {
      setAngle(-120);
      whenReady(() => setTimeout(() => {
        const t0 = performance.now();
        const pull = t => { const k = Math.min(1, (t - t0) / 1600); setAngle(-120 * Math.pow(1 - k, 3)); if (k < 1 && !drag) requestAnimationFrame(pull); };
        requestAnimationFrame(pull);
      }, 900));
    }
  }

  if (!D) return;



  /* ---------- click a panorama to reveal the photo each part came from */
  const pointIn = (pt, poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const centerOf = poly => poly.reduce((a, q) => [a[0] + q[0] / poly.length, a[1] + q[1] / poly.length], [0, 0]);

  // host: positioned box exactly covering the panorama image. frames: [{poly, src, file, exif, ref}]
  function makeReveal(host, frames, { chips } = {}) {
    const svg = svgEl('svg', { class: 'reveal__veil', viewBox: '0 0 1 1', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    const shade = svgEl('path', { class: 'reveal__shade', 'fill-rule': 'evenodd' });
    const edge = svgEl('polygon', { class: 'reveal__edge' });
    svg.append(shade, edge);
    const card = document.createElement('figure');
    card.className = 'reveal__card';
    card.hidden = true;
    card.innerHTML = '<span class="reveal__tape" aria-hidden="true"></span><img alt=""><figcaption class="mono"></figcaption>' +
      '<button type="button" class="reveal__btn reveal__prev" aria-label="Previous frame">&#8249;</button>' +
      '<button type="button" class="reveal__btn reveal__next" aria-label="Next frame">&#8250;</button>' +
      '<button type="button" class="reveal__close" aria-label="Close">&times;</button>';
    host.append(svg, card);
    const cardImg = $('img', card), cap = $('figcaption', card);
    let list = frames, open = -1;
    const chipBtns = [];
    if (chips) {
      chips.replaceChildren();
      const label = document.createElement('span');
      label.className = 'mono reveal__chips-label';
      label.textContent = 'frames';
      chips.append(label);
    }
    const buildChips = () => {
      if (!chips) return;
      chipBtns.splice(0).forEach(b => b.remove());
      list.forEach((f, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'reveal__chip mono';
        b.textContent = String(i + 1).padStart(2, '0');
        b.setAttribute('aria-pressed', 'false');
        b.setAttribute('aria-label', `Show frame ${i + 1}, ${f.file}`);
        b.addEventListener('click', () => (open === i ? hide() : show(i)));
        chips.append(b);
        chipBtns.push(b);
      });
    };
    const place = () => {
      if (open < 0) return;
      const W = host.clientWidth, H = host.clientHeight;
      const cw = Math.max(160, Math.min(420, W * .34, (H * .9 - 44) / .75));
      const [cx] = centerOf(list[open].poly);
      card.style.width = `${cw}px`;
      card.style.left = `${Math.max(8, Math.min(W - cw - 8, cx * W - cw / 2))}px`;
      card.style.top = `${Math.max(6, (H - (cw * .75 + 44)) / 2)}px`;
    };
    function show(i) {
      open = (i + list.length) % list.length;
      const f = list[open];
      const pts = f.poly.map(q => q.join(',')).join(' ');
      shade.setAttribute('d', 'M-1 -1H2V2H-1Z M' + f.poly.map(q => q.join(' ')).join(' L') + 'Z');
      edge.setAttribute('points', pts);
      host.classList.add('is-revealing');
      cardImg.src = f.src;
      cardImg.alt = `Original photo ${open + 1}: ${f.file}`;
      cap.innerHTML = `<b>FRAME ${String(open + 1).padStart(2, '0')}</b> ${f.file}${f.ref ? ' <em>reference</em>' : ''}<br><span>${f.exif}</span>`;
      card.hidden = false;
      card.classList.remove('is-in');
      void card.offsetWidth;
      card.classList.add('is-in');
      chipBtns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === open)));
      place();
    }
    function hide() {
      open = -1;
      host.classList.remove('is-revealing');
      card.hidden = true;
      chipBtns.forEach(b => b.setAttribute('aria-pressed', 'false'));
    }
    const at = e => {
      const r = host.getBoundingClientRect();
      const pt = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
      const hits = list.map((f, i) => i).filter(i => pointIn(pt, list[i].poly));
      if (!hits.length) return -1;
      const d = i => { const c = centerOf(list[i].poly); return Math.hypot(c[0] - pt[0], c[1] - pt[1]); };
      return hits.sort((a, b) => d(a) - d(b))[0];
    };
    $('.reveal__close', card).addEventListener('click', e => { e.stopPropagation(); hide(); });
    $('.reveal__prev', card).addEventListener('click', e => { e.stopPropagation(); show(open - 1); });
    $('.reveal__next', card).addEventListener('click', e => { e.stopPropagation(); show(open + 1); });
    card.addEventListener('click', e => e.stopPropagation());
    card.addEventListener('pointerdown', e => e.stopPropagation());
    host.addEventListener('keydown', e => {
      if (open < 0) return;
      if (e.key === 'Escape') { hide(); e.stopPropagation(); }
      if (e.key === 'ArrowRight' && card.contains(document.activeElement)) show(open + 1);
      if (e.key === 'ArrowLeft' && card.contains(document.activeElement)) show(open - 1);
    });
    new ResizeObserver(place).observe(host);
    buildChips();
    return {
      at, show, hide, get open() { return open; },
      setFrames(next) { list = next; const was = open; hide(); buildChips(); if (was >= 0 && was < list.length) show(was); },
    };
  }

  const plateFrames = m => m.frames.map((f, i) => ({ poly: f.footprint, src: f.src, file: f.file, exif: f.exif, ref: i === m.reference }));

  /* ---------- hero viewfinder: meter each source frame, release the shutter */
  if (plateEl) {
    const m = D.mosaics[0], ref = m.reference;
    const svg = $('[data-frames]'), af = $('[data-af]'), tag = $('[data-frame-tag]');
    const polys = m.frames.map(f => {
      const pg = svgEl('polygon', { points: f.footprint.map(q => q.join(',')).join(' ') });
      svg.appendChild(pg);
      return pg;
    });
    const centroid = f => f.footprint.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);
    const inside = (pt, poly) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const ro = k => $(`[data-ro="${k}"]`);
    const camRef = m.frames[ref].cam;
    let current = -1;
    const show = i => {
      if (i === current) return;
      current = i;
      const c = m.frames[i].cam;
      polys.forEach((pg, k) => pg.classList.toggle('on', k === i));
      ro('frame').textContent = `FR ${String(i + 1).padStart(2, '0')}/${String(m.frames.length).padStart(2, '0')}`;
      ro('f').textContent = (+c.f).toFixed(2).replace(/0$/, '');
      ro('s').textContent = `1/${Math.round(1 / c.t)}`;
      ro('iso').textContent = Math.round(c.iso);
      ro('mm').textContent = Math.round(c.mm);
      const ev = Math.log2((c.t * c.iso) / (camRef.t * camRef.iso));
      ro('ev').textContent = `${ev >= 0 ? '+' : '−'}${Math.abs(ev).toFixed(1)} EV vs ref`;
      ro('needle').style.setProperty('--ev', `${50 + Math.max(-2, Math.min(2, ev)) * 25}%`);
      tag.textContent = `FRAME ${String(i + 1).padStart(2, '0')} · ${m.frames[i].file}${i === ref ? ' · REF' : ''}`;
    };
    show(ref);
    let lockTimer = 0;
    const meter = e => {
      const r = plateEl.getBoundingClientRect();
      const pt = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
      af.style.setProperty('--ax', `${pt[0] * 100}%`);
      af.style.setProperty('--ay', `${pt[1] * 100}%`);
      af.classList.remove('is-lock');
      clearTimeout(lockTimer);
      lockTimer = setTimeout(() => af.classList.add('is-lock'), 380);
      const hits = m.frames.map((f, i) => i).filter(i => inside(pt, m.frames[i].footprint));
      if (!hits.length) return;
      hits.sort((a, b) => {
        const ca = centroid(m.frames[a]), cb = centroid(m.frames[b]);
        return Math.hypot(ca[0] - pt[0], ca[1] - pt[1]) - Math.hypot(cb[0] - pt[0], cb[1] - pt[1]);
      });
      show(hits[0]);
    };
    plateEl.addEventListener('pointermove', meter);
    plateEl.addEventListener('pointerdown', meter);
    plateEl.addEventListener('pointerleave', () => { polys.forEach(pg => pg.classList.remove('on')); current = -1; show(ref); polys[ref].classList.remove('on'); });

    // shutter: a hexagonal iris closes and reopens
    const iris = $('[data-iris]'), flash = $('[data-flash]');
    const blades = svgEl('path', { 'fill-rule': 'evenodd' });
    iris.appendChild(blades);
    const irisAt = (r, rot) => {
      let d = 'M-200 -200H200V200H-200Z M';
      for (let k = 0; k < 6; k++) {
        const a = rot + k * Math.PI / 3;
        d += `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}${k < 5 ? ' L' : 'Z'}`;
      }
      blades.setAttribute('d', d);
    };
    irisAt(200, 0);
    let exposures = 1, firing = false;
    const fire = () => {
      if (firing) return;
      firing = true;
      exposures = exposures % 36 + 1;
      ro('exp').textContent = `EXP ${String(exposures).padStart(2, '0')}/36`;
      af.classList.add('is-lock');
      if (reduced) { flash.classList.remove('is-on'); void flash.offsetWidth; flash.classList.add('is-on'); firing = false; return; }
      const t0 = performance.now(), dur = 520;
      const step = t => {
        const k = Math.min(1, (t - t0) / dur);
        const closed = k < .5 ? k / .5 : (1 - k) / .5;
        irisAt(200 * Math.pow(1 - closed, 2) + .01, closed * 1.2);
        if (k < 1) requestAnimationFrame(step);
        else { irisAt(200, 0); firing = false; }
        if (k >= .5 && !flash.classList.contains('is-on')) flash.classList.add('is-on');
      };
      flash.classList.remove('is-on');
      requestAnimationFrame(step);
    };
    const heroReveal = makeReveal(plateEl, plateFrames(m));
    let lastPick = ref;
    plateEl.addEventListener('click', e => {
      const i = heroReveal.at(e);
      if (i < 0) { heroReveal.hide(); return; }
      lastPick = i;
      fire();
      setTimeout(() => heroReveal.show(i), reduced ? 0 : 420);
    });
    plateEl.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === plateEl) {
        e.preventDefault();
        fire();
        setTimeout(() => heroReveal.show(current >= 0 ? current : lastPick), reduced ? 0 : 420);
      }
    });
  }

  /* ---------- 01: overlap outlines on each print */
  $$('.print[data-frame]').forEach(fig => {
    const [mi, fi] = fig.dataset.frame.split(':').map(Number);
    const m = D.mosaics[mi];
    const holder = $('.print__img', fig);
    const svg = svgEl('svg', { viewBox: '0 0 1 1', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    for (const p of m.pairs) {
      const poly = p.from === fi ? p.poly_in_a : p.to === fi ? p.poly_in_b : null;
      if (!poly) continue;
      svg.appendChild(svgEl('polygon', { class: 'overlap-poly', points: poly.map(q => q.join(',')).join(' ') }));
    }
    holder.appendChild(svg);
  });

  /* ---------- 02: correspondence threads */
  const threads = $('[data-threads]');
  if (threads) {
    const tabs = $('.threads__tabs', threads);
    const imgA = $('img[data-side="a"]', threads), imgB = $('img[data-side="b"]', threads);
    const capA = $('[data-cap="a"]', threads), capB = $('[data-cap="b"]', threads);
    const svg = $('.threads__svg', threads), legend = $('[data-legend]', threads), stat = $('[data-stat]', threads);
    const pairs = [];
    D.mosaics.forEach((m, mi) => m.pairs.forEach(p => pairs.push({ m, mi, p })));
    let current = null;

    pairs.forEach((item, k) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'threads__tab'; b.setAttribute('role', 'tab');
      const fa = item.m.frames[item.p.from].file.replace(/\.\w+$/, ''), fb = item.m.frames[item.p.to].file.replace(/\.\w+$/, '');
      b.textContent = `${['I', 'II', 'III'][item.mi]} · ${fa.replace('mosaic_', '')} → ${fb.replace('mosaic_', '')}`;
      b.addEventListener('click', () => select(k));
      b.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const n = (k + (e.key === 'ArrowRight' ? 1 : -1) + pairs.length) % pairs.length;
          select(n); tabs.children[n].focus();
        }
      });
      tabs.appendChild(b);
    });

    function layout() {
      if (!current) return;
      const box = svg.getBoundingClientRect();
      const ra = imgA.getBoundingClientRect(), rb = imgB.getBoundingClientRect();
      if (!ra.width || !rb.width) return;
      const pos = (r, q) => [r.left - box.left + q[0] * r.width, r.top - box.top + q[1] * r.height];
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      $$('line', svg).forEach((l, i) => {
        const a = pos(ra, current.p.a[i]), b = pos(rb, current.p.b[i]);
        l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]);
      });
      $$('.pt', svg).forEach(g => {
        const i = +g.dataset.i, side = g.dataset.side;
        const [x, y] = side === 'a' ? pos(ra, current.p.a[i]) : pos(rb, current.p.b[i]);
        g.setAttribute('transform', `translate(${x},${y})`);
      });
    }

    function focusPoint(i) {
      svg.classList.toggle('has-focus', i != null);
      $$('line', svg).forEach((l, k) => l.classList.toggle('on', k === i));
      $$('.pt', svg).forEach(g => g.classList.toggle('on', +g.dataset.i === i));
      $$('li', legend).forEach((li, k) => li.classList.toggle('on', k === i));
    }

    function select(k) {
      current = pairs[k];
      const { m, p } = current;
      [...tabs.children].forEach((t, j) => t.setAttribute('aria-selected', String(j === k)));
      const fa = m.frames[p.from], fb = m.frames[p.to];
      imgA.src = fa.src; imgB.src = fb.src;
      imgA.alt = `${fa.file} with ${p.count} numbered landmarks`;
      imgB.alt = `${fb.file} with the same ${p.count} landmarks`;
      capA.textContent = `${fa.file} · side frame`;
      capB.textContent = `${fb.file} · middle frame (reference)`;
      stat.textContent = `${p.count} points · mean ${p.mean.toFixed(2)} px · max ${p.max.toFixed(2)} px`;
      svg.replaceChildren();
      p.a.forEach(() => svg.appendChild(svgEl('line')));
      for (const side of ['a', 'b']) {
        p.a.forEach((_, i) => {
          const g = svgEl('g', { class: 'pt', 'data-i': i, 'data-side': side });
          g.appendChild(svgEl('circle', { r: 6 }));
          const t = svgEl('text', { x: 8, y: -7 }); t.textContent = i + 1; g.appendChild(t);
          g.addEventListener('pointerenter', () => focusPoint(i));
          g.addEventListener('pointerleave', () => focusPoint(null));
          svg.appendChild(g);
        });
      }
      legend.replaceChildren(...p.labels.map((lab, i) => {
        const li = document.createElement('li');
        li.tabIndex = 0;
        li.innerHTML = `<span></span><span>[${p.errors[i].toFixed(1)}]</span>`;
        li.firstChild.textContent = lab || `landmark ${i + 1}`;
        li.addEventListener('pointerenter', () => focusPoint(i));
        li.addEventListener('pointerleave', () => focusPoint(null));
        li.addEventListener('focus', () => focusPoint(i));
        li.addEventListener('blur', () => focusPoint(null));
        return li;
      }));
      // matrix card follows the selected pair
      $('[data-hlabel]').textContent = `recovered H: ${fa.file} → ${fb.file}`;
      $('[data-hmatrix]').innerHTML = p.matrix;
      $('[data-hstats]').innerHTML = `<div><dt>points</dt><dd>${p.count}</dd></div><div><dt>mean error</dt><dd>${p.mean.toFixed(2)} px</dd></div><div><dt>max error</dt><dd>${p.max.toFixed(2)} px</dd></div>`;
      let loaded = 0;
      const done = () => { if (++loaded >= 2) layout(); };
      [imgA, imgB].forEach(im => im.complete && im.naturalWidth ? done() : im.addEventListener('load', done, { once: true }));
    }
    new ResizeObserver(layout).observe(threads);
    select(2);
  }

  /* ---------- 03: corner quads on the rectification sources */
  $$('[data-quad]').forEach(svg => {
    const r = D.rects[+svg.dataset.quad];
    const pts = r.corners.map(c => c.join(',')).join(' ');
    svg.appendChild(svgEl('polygon', { points: pts }));
    // circles in a 0..1 viewBox with non-uniform scale would be ellipses; use tiny polygons via markers instead
    r.corners.forEach(c => svg.appendChild(svgEl('circle', { cx: c[0], cy: c[1], r: .008 })));
  });

  /* ---------- 04/05: before / after sliders */
  $$('[data-compare]').forEach(cmp => {
    const range = $('.compare__range', cmp);
    const set = v => cmp.style.setProperty('--pos', `${v}%`);
    range.addEventListener('input', () => set(range.value));
    set(range.value);
  });

  /* ---------- 04: panorama walk-through + lightbox */
  const lb = $('[data-lightbox]');
  const lbImg = $('[data-lightbox-img]'), lbScroll = $('[data-lightbox-scroll]');
  const openLightbox = (src, alt) => {
    if (!lb.showModal) { window.open(src, '_blank'); return; }
    lbImg.src = src; lbImg.alt = alt || '';
    lb.showModal();
    lbImg.decode?.().then(() => { lbScroll.scrollLeft = (lbScroll.scrollWidth - lbScroll.clientWidth) / 2; }).catch(() => {});
  };
  $('[data-lightbox-close]').addEventListener('click', () => lb.close());
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  dragScroll(lbScroll);

  $$('[data-pano]').forEach(pano => {
    const track = $('.pano__track', pano), img = $('img', track), walk = $('[data-pano-walk]', pano);
    walk.addEventListener('click', () => {
      const on = !pano.classList.contains('is-walking');
      pano.classList.toggle('is-walking', on);
      walk.setAttribute('aria-pressed', String(on));
      walk.textContent = on ? 'Fit to width' : 'Walk through it';
      if (on) requestAnimationFrame(() => { track.scrollLeft = (track.scrollWidth - track.clientWidth) / 2; });
    });
    $('[data-pano-full]', pano).addEventListener('click', () => openLightbox(img.dataset.full, img.alt));
    const mi = +pano.closest('[data-mosaic]')?.dataset.mosaic;
    if (D.mosaics[mi]) {
      const host = document.createElement('div');
      host.className = 'reveal-host';
      img.before(host);
      host.append(img);
      const chips = document.createElement('div');
      chips.className = 'reveal__chips';
      $('.pano__bar', pano).append(chips);
      const rv = makeReveal(host, plateFrames(D.mosaics[mi]), { chips });
      let moved = 0, sx = 0;
      host.addEventListener('pointerdown', e => { sx = e.clientX; moved = 0; });
      host.addEventListener('pointermove', e => { moved = Math.max(moved, Math.abs(e.clientX - sx)); });
      host.addEventListener('click', e => {
        if (moved > 6) return;
        const i = rv.at(e);
        if (i < 0 || i === rv.open) rv.hide(); else rv.show(i);
      });
    }
    track.addEventListener('keydown', e => {
      if (!pano.classList.contains('is-walking')) return;
      if (e.key === 'ArrowRight') { track.scrollBy({ left: 160, behavior: 'smooth' }); e.preventDefault(); }
      if (e.key === 'ArrowLeft') { track.scrollBy({ left: -160, behavior: 'smooth' }); e.preventDefault(); }
    });
    dragScroll(track, () => pano.classList.contains('is-walking'));
  });
  $$('[data-open]').forEach(b => b.addEventListener('click', () => openLightbox(b.dataset.open, $('img', b)?.alt || b.dataset.alt || '')));

  function dragScroll(el, enabled = () => true) {
    let sx = 0, sy = 0, sl = 0, st = 0, down = false;
    el.addEventListener('pointerdown', e => {
      if (!enabled() || e.pointerType !== 'mouse') return;
      down = true; sx = e.clientX; sy = e.clientY; sl = el.scrollLeft; st = el.scrollTop;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!down) return;
      el.scrollLeft = sl - (e.clientX - sx); el.scrollTop = st - (e.clientY - sy);
    });
    const up = () => { down = false; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }

  /* ---------- 05: masquerade lens over the weight map */
  $$('[data-lens]').forEach(lens => {
    let fx = .5, fy = .45;
    const place = () => {
      lens.style.setProperty('--mx', `${fx * 100}%`);
      lens.style.setProperty('--my', `${fy * 100}%`);
    };
    lens.addEventListener('pointermove', e => {
      const r = lens.getBoundingClientRect();
      // mask-position percentages align the mask's own point with the box point
      fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      place();
    });
    lens.addEventListener('pointerenter', () => lens.style.setProperty('--ms', '34%'));
    lens.addEventListener('keydown', e => {
      const step = .04;
      const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (moves[e.key]) {
        fx = Math.min(1, Math.max(0, fx + moves[e.key][0]));
        fy = Math.min(1, Math.max(0, fy + moves[e.key][1]));
        place(); e.preventDefault();
      }
      if (e.key === 'Enter' || e.key === ' ') {
        lens.style.setProperty('--ms', lens.style.getPropertyValue('--ms') === '300%' ? '34%' : '300%');
        e.preventDefault();
      }
    });
    place();
  });

  /* ---------- 06: planar vs cylinder, by radius */
  const cyl = $('[data-cyl]');
  if (cyl && D.skyline) {
    const runs = D.skyline.runs;
    const order = [1, 2, 3, 4, 5, 0];
    const img = $('[data-cyl-img]', cyl), range = $('[data-cyl-range]', cyl);
    const hud = k => $(`[data-hud="${k}"]`, cyl);
    let shown = 3, preloaded = false, onRun = null;
    const fmt = n => n.toLocaleString('en-US');
    const set = v => {
      const r = runs[order[v]];
      if (!preloaded) { runs.forEach(x => { const i = new Image(); i.src = x.src; }); preloaded = true; }
      img.classList.add('is-swap');
      setTimeout(() => {
        img.src = r.src;
        img.alt = r.kind === 'planar' ? 'Planar mosaic of all five sunset frames.' : `Cylindrical mosaic at radius ${Math.round(r.f)} px.`;
        img.onload = () => img.classList.remove('is-swap');
        onRun?.(r);
      }, reduced ? 0 : 180);
      hud('label').textContent = r.kind === 'planar' ? `PLANAR · shown at ${r.scale.toFixed(2)} scale` : `CYLINDER · f = ${Math.round(r.f)} px (${r.scale}×)`;
      hud('size').textContent = `${fmt(r.w_full || r.w)} × ${fmt(r.h_full || r.h)}`;
      hud('cov').textContent = `coverage ${Math.round(r.coverage * 100)}%`;
      hud('mag').textContent = `stretch ${r.mag_median.toFixed(2)}× median, ${r.mag_max.toFixed(2)}× max`;
      shown = v;
    };
    range.addEventListener('input', () => set(+range.value));
    $('[data-cyl-toggle]', cyl).addEventListener('click', () => { range.value = shown === 5 ? 2 : 5; set(+range.value); });
    const openFull = () => openLightbox(runs[order[shown]].full, img.alt);
    $('[data-cyl-full]', cyl).addEventListener('click', openFull);
    const host = document.createElement('div');
    host.className = 'reveal-host reveal-host--cyl';
    img.before(host);
    host.append(img);
    const chips = document.createElement('div');
    chips.className = 'reveal__chips';
    $('.lensring__btns', cyl).after(chips);
    const skyFrames = r => D.skyline.frames.map((f, i) => ({ ...f, poly: r.polys[i] }));
    const frameBox = $('.cyl__frame', cyl);
    const fitHost = () => {
      const r = runs[order[shown]], ar = r.w / r.h, fw = frameBox.clientWidth, fh = frameBox.clientHeight;
      const w = fw / fh > ar ? fh * ar : fw;
      host.style.width = `${w}px`;
      host.style.height = `${w / ar}px`;
    };
    new ResizeObserver(fitHost).observe(frameBox);
    const rv = makeReveal(host, skyFrames(runs[order[2]]), { chips });
    host.addEventListener('click', e => { const i = rv.at(e); if (i < 0 || i === rv.open) rv.hide(); else rv.show(i); });
    onRun = r => { fitHost(); rv.setFrames(skyFrames(r)); };
    range.value = 2;
  }

  /* ================================================================ REEL B
     Everything below draws from D.partb, which the build copies out of the
     Part B pipeline's output (points, matches, RANSAC log, inlier counts). */
  const PB = D.partb;
  if (PB) {
    const loadImage = src => new Promise(resolve => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
    const ready = img => (img.complete && img.naturalWidth ? Promise.resolve() : new Promise(r => img.addEventListener('load', r, { once: true })));
    const fitCanvas = (canvas, w, h) => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const cw = Math.max(1, Math.round(w * dpr)), ch = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      return ctx;
    };
    const shortName = f => f.replace(/\.\w+$/, '').replace('mosaic_', '');
    const fmtN = n => n.toLocaleString('en-US');
    const makeTabs = (holder, labels, onSelect) => {
      const buttons = labels.map((label, k) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tab';
        b.setAttribute('role', 'tab');
        b.textContent = label;
        b.addEventListener('click', () => select(k));
        b.addEventListener('keydown', e => {
          if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
          const n = (k + (e.key === 'ArrowRight' ? 1 : -1) + labels.length) % labels.length;
          select(n);
          buttons[n].focus();
        });
        holder.append(b);
        return b;
      });
      function select(k) {
        buttons.forEach((b, j) => b.setAttribute('aria-selected', String(j === k)));
        onSelect(k);
      }
      return select;
    };
    // a 40x40 working-pixel window around (x, y), cut from the displayed photo
    const drawWindow = (canvas, img, frame, x, y, grid) => {
      const ctx = canvas.getContext('2d'), s = img.naturalWidth / frame.w;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, (x - 20) * s, (y - 20) * s, 40 * s, 40 * s, 0, 0, canvas.width, canvas.height);
      if (!grid) return;
      ctx.strokeStyle = 'rgba(255,255,255,.28)';
      ctx.lineWidth = 1;
      for (let k = 1; k < 8; k++) {
        const p = Math.round(k * canvas.width / 8) + .5;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, canvas.height); ctx.moveTo(0, p); ctx.lineTo(canvas.width, p); ctx.stroke();
      }
    };
    // descriptor k of a frame, read from its atlas of 8x8 tiles (50 per row)
    const drawDescriptor = (canvas, atlas, k) => {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (atlas && k >= 0) ctx.drawImage(atlas, (k % 50) * 8, Math.floor(k / 50) * 8, 8, 8, 0, 0, canvas.width, canvas.height);
    };
    const atlasCache = new Map();
    const atlasOf = frame => {
      if (!atlasCache.has(frame.atlas)) atlasCache.set(frame.atlas, loadImage(frame.atlas));
      return atlasCache.get(frame.atlas);
    };

    /* ---------- 07: corner lab */
    const lab = $('[data-cornerlab]');
    if (lab) {
      const stage = $('[data-cl-stage]', lab), photo = $('[data-cl-photo]', lab), all = $('[data-cl-all]', lab);
      const canvas = $('[data-cl-canvas]', lab), range = $('[data-cl-n]', lab), readout = $('[data-cl-readout]', lab);
      const modeBtns = $$('[data-cl-mode]', lab);
      let mi = 1, mode = 'anms', hover = -1;
      const frame = () => PB.mosaics[mi].frames[PB.mosaics[mi].reference];
      const draw = () => {
        const f = frame(), w = stage.clientWidth, h = stage.clientHeight, s = w / f.w;
        const ctx = fitCanvas(canvas, w, h);
        stage.classList.toggle('is-all', mode === 'all');
        lab.classList.toggle('is-all', mode === 'all');
        if (mode === 'all') {
          readout.textContent = `${fmtN(f.harris)} Harris corners above the threshold`;
          return;
        }
        const pts = mode === 'anms' ? f.anms : f.strongest, n = Math.min(+range.value, pts.length);
        const r = Math.max(1.5, Math.min(3, w / 440));
        ctx.fillStyle = '#ff2d4f';
        ctx.strokeStyle = 'rgba(255,255,255,.8)';
        ctx.lineWidth = .6;
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.arc(pts[i][0] * s, pts[i][1] * s, r, 0, 6.2832);
          ctx.fill();
          ctx.stroke();
        }
        if (mode === 'strongest') {
          readout.textContent = `the ${fmtN(n)} strongest corners, no suppression`;
          return;
        }
        let text = `ANMS ${fmtN(n)} · suppression radius ${f.anms[n - 1][2]} px`;
        if (hover >= 0 && hover < n) {
          const [x, y, rad] = f.anms[hover];
          ctx.strokeStyle = '#ffd27a';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(x * s, y * s, r + 3, 0, 6.2832); ctx.stroke();
          if (rad < 9999) {
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.arc(x * s, y * s, rad * s, 0, 6.2832); ctx.stroke();
            ctx.setLineDash([]);
            text += ` · this corner is the strongest within ${rad} px`;
          } else text += ' · this is the strongest corner in the frame';
        }
        readout.textContent = text;
      };
      const select = makeTabs($('[data-cl-tabs]', lab), PB.mosaics.map(m => `${m.roman} · ${shortName(m.frames[m.reference].file)}`), k => {
        mi = k;
        hover = -1;
        const f = frame();
        photo.src = f.src;
        photo.alt = `${f.file} with detected corners drawn on top`;
        all.src = f.overlay;
        range.max = f.anms.length;
        if (+range.value > f.anms.length) range.value = f.anms.length;
        ready(photo).then(draw);
      });
      modeBtns.forEach(b => b.addEventListener('click', () => {
        mode = b.dataset.clMode;
        modeBtns.forEach(o => o.setAttribute('aria-pressed', String(o === b)));
        draw();
      }));
      range.addEventListener('input', draw);
      canvas.addEventListener('pointermove', e => {
        if (mode !== 'anms') return;
        const f = frame(), box = canvas.getBoundingClientRect(), s = box.width / f.w;
        const x = (e.clientX - box.left) / s, y = (e.clientY - box.top) / s, n = Math.min(+range.value, f.anms.length);
        let best = -1, bd = (14 / s) ** 2;
        for (let i = 0; i < n; i++) {
          const d = (f.anms[i][0] - x) ** 2 + (f.anms[i][1] - y) ** 2;
          if (d < bd) { bd = d; best = i; }
        }
        if (best !== hover) { hover = best; draw(); }
      });
      canvas.addEventListener('pointerleave', () => { if (hover >= 0) { hover = -1; draw(); } });
      new ResizeObserver(draw).observe(stage);
      select(1);
    }

    /* ---------- 08: descriptor contact sheet */
    const dl = $('[data-desclab]');
    if (dl) {
      const photo = $('[data-dl-photo]', dl), canvas = $('[data-dl-canvas]', dl), sheet = $('[data-dl-sheet]', dl), cap = $('[data-dl-cap]', dl);
      let mi = 1, picks = [], on = -1;
      const frame = () => PB.mosaics[mi].frames[PB.mosaics[mi].reference];
      const mark = () => {
        const f = frame(), w = photo.clientWidth, h = photo.clientHeight, s = w / f.w;
        const ctx = fitCanvas(canvas, w, h);
        ctx.font = '600 10px ui-monospace, Menlo, monospace';
        picks.forEach((k, n) => {
          const [x, y] = f.anms[k], hot = n === on;
          ctx.strokeStyle = hot ? '#ffd23a' : 'rgba(255,255,255,.85)';
          ctx.lineWidth = hot ? 2.2 : 1.1;
          ctx.strokeRect((x - 20) * s, (y - 20) * s, 40 * s, 40 * s);
          ctx.fillStyle = hot ? '#ffd23a' : '#fff';
          ctx.fillText(String(n + 1), (x - 20) * s + 2, (y - 20) * s - 3);
        });
      };
      const render = async () => {
        const f = frame();
        await ready(photo);
        const atlas = await atlasOf(f);
        sheet.replaceChildren(...picks.map((k, n) => {
          const li = document.createElement('li');
          li.tabIndex = 0;
          const win = document.createElement('canvas'), desc = document.createElement('canvas');
          win.width = win.height = desc.width = desc.height = 96;
          drawWindow(win, photo, f, f.anms[k][0], f.anms[k][1], true);
          drawDescriptor(desc, atlas, k);
          const label = document.createElement('span');
          label.textContent = `${n + 1} · corner #${k + 1}`;
          li.append(win, desc, label);
          const hot = v => { on = v ? n : -1; $$('li', sheet).forEach((o, j) => o.classList.toggle('is-on', j === on)); mark(); };
          li.addEventListener('pointerenter', () => hot(true));
          li.addEventListener('pointerleave', () => hot(false));
          li.addEventListener('focus', () => hot(true));
          li.addEventListener('blur', () => hot(false));
          return li;
        }));
        cap.textContent = `${f.file} · 12 of its ${fmtN(f.anms.length)} features · left: 40 px window with the 8 x 8 sampling grid, right: normalized descriptor`;
        mark();
      };
      const shuffle = () => {
        const f = frame(), set = new Set();
        while (set.size < 12) set.add(Math.floor(Math.random() * f.anms.length));
        picks = [...set].sort((a, b) => a - b);
        on = -1;
        render();
      };
      const select = makeTabs($('[data-dl-tabs]', dl), PB.mosaics.map(m => `${m.roman} · ${shortName(m.frames[m.reference].file)}`), k => {
        mi = k;
        const f = frame();
        photo.src = f.src;
        photo.alt = `${f.file} with the twelve sampled windows outlined`;
        shuffle();
      });
      $('[data-dl-shuffle]', dl).addEventListener('click', shuffle);
      new ResizeObserver(mark).observe(photo);
      select(1);
    }

    /* ---------- 09: ratio histogram (my figure 6b) */
    let setThreshold = () => {};
    const histo = $('[data-histo]');
    if (histo) {
      const W = 640, H = 300, L = 46, R = 14, T = 16, B = 40;
      const n = PB.hist.correct.length;
      const density = a => { const total = a.reduce((x, y) => x + y, 0); return a.map(v => v / total * n); };
      const dc = density(PB.hist.correct), di = density(PB.hist.incorrect);
      const ymax = Math.ceil(Math.max(...dc, ...di));
      const X = r => L + r * (W - L - R), Y = v => H - B - v / ymax * (H - T - B);
      const steps = d => d.map((v, i) => `${i ? 'L' : 'M'}${X(i / n).toFixed(1)} ${Y(v).toFixed(1)} L${X((i + 1) / n).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
      for (let v = 0; v <= ymax; v++) {
        histo.append(svgEl('line', { class: 'grid', x1: L, x2: W - R, y1: Y(v), y2: Y(v) }));
        const t = svgEl('text', { x: L - 8, y: Y(v) + 3, 'text-anchor': 'end' });
        t.textContent = v;
        histo.append(t);
      }
      for (let k = 0; k <= 10; k += 2) {
        const t = svgEl('text', { x: X(k / 10), y: H - B + 16, 'text-anchor': 'middle' });
        t.textContent = (k / 10).toFixed(1);
        histo.append(t);
      }
      const xl = svgEl('text', { x: (L + W - R) / 2, y: H - 4, 'text-anchor': 'middle' });
      xl.textContent = '1-NN / 2-NN squared error';
      const yl = svgEl('text', { x: 12, y: (T + H - B) / 2, 'text-anchor': 'middle', transform: `rotate(-90 12 ${(T + H - B) / 2})` });
      yl.textContent = 'probability density';
      histo.append(xl, yl,
        svgEl('path', { class: 'okfill', d: `${steps(dc)} L${X(1)} ${Y(0)} L${X(0)} ${Y(0)} Z` }),
        svgEl('path', { class: 'bad', d: steps(di) }), svgEl('path', { class: 'ok', d: steps(dc) }),
        svgEl('line', { class: 'axis', x1: L, x2: W - R, y1: Y(0), y2: Y(0) }), svgEl('line', { class: 'axis', x1: L, x2: L, y1: T, y2: Y(0) }));
      const thr = svgEl('line', { class: 'thr', y1: T, y2: Y(0) }), label = svgEl('text', { class: 'thrlabel', y: T + 9 });
      histo.append(thr, label);
      setThreshold = t => {
        thr.setAttribute('x1', X(t));
        thr.setAttribute('x2', X(t));
        label.setAttribute('x', t > .8 ? X(t) - 6 : X(t) + 6);
        label.setAttribute('text-anchor', t > .8 ? 'end' : 'start');
        label.textContent = `threshold ${t.toFixed(2)}`;
      };
      setThreshold(PB.settings.ratio);
    }

    /* ---------- 09 + 10: the match bench (ratio test, and RANSAC replay) */
    $$('[data-bench]').forEach(root => {
      const mode = root.dataset.bench;
      const stage = $('[data-b-stage]', root), canvas = $('[data-b-canvas]', root);
      const imgA = $('[data-b-img="a"]', root), imgB = $('[data-b-img="b"]', root);
      const capA = $('[data-b-cap="a"]', root), capB = $('[data-b-cap="b"]', root);
      const stat = $('[data-b-stat]', root), loupe = $('[data-b-loupe]', root), loupeCap = $('[data-b-loupecap]', root);
      const slider = $('[data-b-ratio]', root);
      const pairs = [];
      PB.mosaics.forEach(m => m.pairs.forEach(p => pairs.push({ m, p })));
      let cur = null, hover = -1, step = 0, timer = 0;
      const geometry = () => {
        const box = stage.getBoundingClientRect(), ra = imgA.getBoundingClientRect(), rb = imgB.getBoundingClientRect();
        const fa = cur.m.frames[cur.p.from], fb = cur.m.frames[cur.p.to];
        return {
          w: box.width, h: box.height,
          A: r => [ra.left - box.left + r[0] / fa.w * ra.width, ra.top - box.top + r[1] / fa.h * ra.height],
          B: r => [rb.left - box.left + r[2] / fb.w * rb.width, rb.top - box.top + r[3] / fb.h * rb.height],
        };
      };
      // which rows are on screen, and each one's role: 'ok', 'bad', 'in' or 'pick'
      const visible = () => {
        const rows = cur.p.rows;
        if (mode === 'ratio') {
          const t = +slider.value * 10;
          const out = [];
          rows.forEach((r, i) => { if (r[4] < t) out.push([i, r[5] & 1 ? 'ok' : 'bad']); });
          return out;
        }
        const log = cur.p.log;
        if (step >= log.length) return cur.p.cand.map(i => [i, rows[i][5] & 4 ? 'in' : 'bad']);
        const e = log[step];
        return cur.p.cand.map((i, c) => [i, e.s.includes(i) ? 'pick' : e.in[c] === '1' ? 'in' : 'bad']);
      };
      const STYLE = { ok: ['#ffd23a', .75, 1], bad: ['#ff4a4a', .42, .8], in: ['#35ff6b', .8, 1], pick: ['#ffffff', 1, 2.6] };
      const draw = () => {
        if (!cur || !imgA.naturalWidth || !imgB.naturalWidth) return;
        const g = geometry(), ctx = fitCanvas(canvas, g.w, g.h), rows = cur.p.rows, vis = visible();
        for (const role of ['bad', 'ok', 'in', 'pick']) {
          const [color, alpha, width] = STYLE[role];
          ctx.strokeStyle = ctx.fillStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = width;
          for (const [i, r] of vis) {
            if (r !== role) continue;
            const a = g.A(rows[i]), b = g.B(rows[i]);
            ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
            const dot = role === 'pick' ? 4 : 1.8;
            ctx.beginPath(); ctx.arc(a[0], a[1], dot, 0, 6.2832); ctx.arc(b[0], b[1], dot, 0, 6.2832); ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
        if (hover >= 0 && vis.some(v => v[0] === hover)) {
          const a = g.A(rows[hover]), b = g.B(rows[hover]);
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          for (const q of [a, b]) { ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, 6.2832); ctx.stroke(); }
        }
        if (mode === 'ratio') {
          const ok = vis.filter(v => v[1] === 'ok').length;
          stat.textContent = `ratio < ${(+slider.value / 100).toFixed(2)}: ${vis.length} matches, ${ok} agree with the final homography` +
            (vis.length ? ` (${Math.round(100 * ok / vis.length)}%)` : '');
        } else {
          const log = cur.p.log;
          stat.textContent = step >= log.length
            ? `After ${fmtN(PB.settings.ransac_iters)} rounds: least squares on the winning set gives ${cur.p.inliers} inliers of ${cur.p.matches}, mean error ${cur.p.err.toFixed(2)} px.`
            : `Round ${fmtN(log[step].it)} of ${fmtN(PB.settings.ransac_iters)}: these four matches agree with ${log[step].n} of ${cur.p.matches}. Best so far (${step + 1} of ${log.length}).`;
        }
      };
      const showLoupe = async i => {
        const r = cur.p.rows[i], fa = cur.m.frames[cur.p.from], fb = cur.m.frames[cur.p.to];
        const token = cur;
        const [atA, atB] = await Promise.all([atlasOf(fa), atlasOf(fb)]);
        if (token !== cur) return;
        loupe.hidden = false;
        drawWindow($('[data-b-win="a"]', root), imgA, fa, r[0], r[1]);
        drawWindow($('[data-b-win="b"]', root), imgB, fb, r[2], r[3]);
        drawDescriptor($('[data-b-desc="a"]', root), atA, r[6]);
        drawDescriptor($('[data-b-desc="b"]', root), atB, r[7]);
        const verdict = mode === 'ransac' && r[5] & 2 ? (r[5] & 4 ? 'RANSAC inlier' : 'RANSAC outlier') : (r[5] & 1 ? 'agrees with the final homography' : 'does not agree with the homography');
        loupeCap.textContent = `top: ${shortName(fa.file)}, bottom: ${shortName(fb.file)} · window and descriptor · ratio ${(r[4] / 1000).toFixed(2)} · ${verdict}`;
      };
      stage.addEventListener('pointermove', e => {
        if (!cur) return;
        const g = geometry(), box = stage.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
        let best = -1, bd = 14 * 14;
        for (const [i] of visible()) {
          for (const q of [g.A(cur.p.rows[i]), g.B(cur.p.rows[i])]) {
            const d = (q[0] - x) ** 2 + (q[1] - y) ** 2;
            if (d < bd) { bd = d; best = i; }
          }
        }
        if (best !== hover) {
          hover = best;
          draw();
          if (best >= 0) showLoupe(best);
        }
      });
      stage.addEventListener('pointerleave', () => { if (hover >= 0) { hover = -1; draw(); } });
      const stop = () => { clearInterval(timer); timer = 0; };
      const select = makeTabs($('[data-b-tabs]', root), pairs.map(({ m, p }) => `${m.roman} · ${shortName(m.frames[p.from].file)} → ${shortName(m.frames[p.to].file)}`), k => {
        stop();
        cur = pairs[k];
        hover = -1;
        loupe.hidden = true;
        step = cur.p.log.length;
        const fa = cur.m.frames[cur.p.from], fb = cur.m.frames[cur.p.to];
        imgA.src = fa.src;
        imgB.src = fb.src;
        imgA.alt = `${fa.file}, side frame, with its matched corners`;
        imgB.alt = `${fb.file}, middle frame, with the matching corners`;
        capA.textContent = `${fa.file} · side frame`;
        capB.textContent = `${fb.file} · middle frame`;
        Promise.all([ready(imgA), ready(imgB)]).then(draw);
      });
      if (slider) slider.addEventListener('input', () => { setThreshold(+slider.value / 100); draw(); });
      if (mode === 'ransac') {
        $('[data-b-play]', root).addEventListener('click', () => {
          stop();
          step = 0;
          draw();
          if (reduced) return;
          timer = setInterval(() => {
            step++;
            draw();
            if (step >= cur.p.log.length) stop();
          }, 1300);
        });
        $('[data-b-prev]', root).addEventListener('click', () => { stop(); step = Math.max(0, step - 1); draw(); });
        $('[data-b-next]', root).addEventListener('click', () => { stop(); step = Math.min(cur.p.log.length, step + 1); draw(); });
      }
      new ResizeObserver(draw).observe(stage);
      select(2);
    });

    /* ---------- 12: the shoebox matrix */
    const sb = $('[data-shoebox]');
    if (sb) {
      const R = PB.rec, n = R.photos.length, grid = $('[data-sb-matrix]', sb);
      const imgs = [$('[data-sb-img="a"]', sb), $('[data-sb-img="b"]', sb)];
      const stat = $('[data-sb-stat]', sb), verdict = $('[data-sb-verdict]', sb);
      const short = s => s.replace('mosaic_', '').replace('recti_book_1', 'book').replace('recti menu 2', 'menu');
      const top = Math.log(Math.max(...R.inliers.flat()));
      const STOPS = [[36, 29, 24], [123, 53, 71], [231, 162, 58], [255, 236, 180]];
      const shade = t => {
        const k = Math.min(STOPS.length - 2, Math.floor(t * (STOPS.length - 1))), u = t * (STOPS.length - 1) - k;
        return `rgb(${STOPS[k].map((c, i) => Math.round(c + (STOPS[k + 1][i] - c) * u)).join(',')})`;
      };
      grid.style.gridTemplateColumns = `auto repeat(${n}, minmax(0, 1fr))`;
      grid.append(document.createElement('span'));
      R.photos.forEach(p => {
        const s = document.createElement('span');
        s.className = 'lab lab--col';
        s.textContent = short(p);
        grid.append(s);
      });
      let lit = null;
      const show = (i, j, cell) => {
        imgs[0].src = R.thumbs[i];
        imgs[1].src = R.thumbs[j];
        imgs[0].alt = R.photos[i];
        imgs[1].alt = R.photos[j];
        const v = R.inliers[i][j];
        stat.textContent = `${short(R.photos[i])} + ${short(R.photos[j])}: ${v} inliers out of ${R.matches[i][j]} matches`;
        verdict.textContent = v >= R.min ? 'same panorama' : 'not a pair';
        lit?.classList.remove('is-on');
        lit = cell;
        cell.classList.add('is-on');
      };
      let first = null;
      R.photos.forEach((p, i) => {
        const s = document.createElement('span');
        s.className = 'lab';
        s.textContent = short(p);
        grid.append(s);
        R.photos.forEach((q, j) => {
          const cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'cell';
          if (i === j) {
            cell.classList.add('is-self');
            cell.disabled = true;
            cell.setAttribute('aria-label', p);
          } else {
            const v = R.inliers[i][j];
            cell.style.background = shade(Math.log(Math.max(v, 1)) / top);
            cell.textContent = v;
            cell.classList.toggle('is-link', v >= R.min);
            cell.setAttribute('aria-label', `${p} and ${q}: ${v} inliers`);
            for (const type of ['pointerenter', 'focus', 'click']) cell.addEventListener(type, () => show(i, j, cell));
            if (!first && v >= R.min) first = [i, j, cell];
          }
          grid.append(cell);
        });
      });
      if (first) show(...first);
    }
  }
})();
