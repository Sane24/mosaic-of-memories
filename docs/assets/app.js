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
  const links = new Map($$('.topnav a').map(a => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
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

  /* ---------- scroll reveals */
  const revealTargets = $$('.strip, .index-card, .rectify__stage, .loupe, .plate-ex__body, .pano, .shares, .bells, .letter, .filmstrip, .pinned-note, .capture-notes, .prose--two');
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
    slate.innerHTML = `<span>ROLL<b>A</b></span><span>SCENE<b>${scene}</b></span><span>TAKE<b>1</b></span>`;
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
  $$('[data-open]').forEach(b => b.addEventListener('click', () => openLightbox(b.dataset.open, $('img', b).alt)));

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
})();
