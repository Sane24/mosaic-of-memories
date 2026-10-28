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

  /* ---------- hero: gentle pointer parallax on the plate */
  const plate = $('[data-parallax]');
  if (plate && !reduced && matchMedia('(pointer: fine)').matches) {
    let raf = 0;
    addEventListener('pointermove', e => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const x = (e.clientX / innerWidth - .5), y = (e.clientY / innerHeight - .5);
        plate.style.transform = `translate3d(${x * -10}px, ${y * -6}px, 0)`;
      });
    });
  }

  if (!D) return;

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
    img.addEventListener('click', () => { if (!pano.classList.contains('is-walking')) openLightbox(img.dataset.full, img.alt); });
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
})();
