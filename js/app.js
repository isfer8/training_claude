/* CCDV-F Prep — single-page app, no build step.
 * Data comes from window.DOMAINS, window.GLOSSARY and window.QUESTIONS (see /data).
 */
(function () {
  'use strict';

  const DOMAINS = window.DOMAINS || [];
  const GLOSSARY = window.GLOSSARY || { terms: [], phrases: [] };
  // Question files use a compact format; normalise it here.
  //   { id, d: domain, t: 's'|'m', lvl: 1-3, q: [en, es], o: [[en, es] | 'same text'], a: [indexes], x: [en, es], ref }
  const pair = v => (Array.isArray(v) ? { en: v[0], es: v[1] || v[0] } : (typeof v === 'string' ? { en: v, es: v } : v));
  const QUESTIONS = (window.QUESTIONS || []).map(r => ({
    id: r.id,
    domain: r.d || r.domain,
    type: (r.t || r.type) === 'm' || r.type === 'multi' ? 'multi' : 'single',
    difficulty: r.lvl || r.difficulty || 2,
    q: pair(r.q),
    options: (r.o || r.options).map(pair),
    answer: r.a || r.answer,
    explain: pair(r.x || r.explain),
    ref: r.ref
  }));
  const QMAP = new Map(QUESTIONS.map(q => [q.id, q]));
  const DMAP = new Map(DOMAINS.map(d => [d.id, d]));

  const EXAM = { total: 53, minutes: 120, pass: 720 };
  const LETTERS = 'ABCDEFGH';
  const app = document.getElementById('app');

  /* ---------------- Storage (wrapped: storage can be unavailable) ---------------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem('ccdvf.' + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('ccdvf.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
    },
    del(key) {
      try { localStorage.removeItem('ccdvf.' + key); } catch (e) { /* ignore */ }
    }
  };

  const settings = Object.assign({ lang: 'help', examSpanish: false }, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);
  let stats = store.get('stats', {});           // { [qid]: { seen, correct, last } }
  let history = store.get('history', []);       // exam results
  let practice = null;                          // in-memory practice session
  let lastResult = null;                        // in-memory last exam result (with items)
  let timerHandle = null;
  let inExam = false;

  /* ---------------- Helpers ---------------- */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
  const pct = (c, t) => (t ? Math.round((c / t) * 100) : 0);
  const scaled = (c, t) => (t ? Math.round(100 + 900 * (c / t)) : 100);
  const fmtTime = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return (h ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  };
  const fmtDate = ts => new Date(ts).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });

  function contentLang() {
    if (inExam && !settings.examSpanish) return 'en';
    return settings.lang;
  }

  /** Render a bilingual value {en, es}. block=true uses <div> wrappers (for HTML bodies). */
  function bi(obj, block) {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    const mode = contentLang();
    if (mode === 'en' || !obj.es || obj.es === obj.en) return obj.en;
    if (mode === 'es') return obj.es;
    const tag = block ? 'div' : 'span';
    return `<${tag} class="bi"><${tag} class="en-text">${obj.en}</${tag}>` +
      `<button type="button" class="es-toggle" title="Ver en español">ES</button>` +
      `<${tag} class="es-text">${obj.es}</${tag}></${tag}>`;
  }
  const dnamePlain = id => {
    const d = DMAP.get(id);
    if (!d) return id;
    return settings.lang === 'es' ? d.name.es : d.name.en;
  };

  function recordAnswer(qid, ok) {
    const s = stats[qid] || { seen: 0, correct: 0, last: null };
    s.seen++; if (ok) s.correct++; s.last = ok;
    stats[qid] = s;
    store.set('stats', stats);
  }

  function domainStats(domainId) {
    let seen = 0, correct = 0, answered = 0;
    for (const q of QUESTIONS) {
      if (domainId && q.domain !== domainId) continue;
      const s = stats[q.id];
      if (s) { answered++; seen += s.seen; correct += s.correct; }
    }
    return { seen, correct, answered };
  }

  /* ---------------- Modal (no native alert/confirm) ---------------- */
  function confirmBox(text, okLabel) {
    return new Promise(resolve => {
      const modal = document.getElementById('modal');
      document.getElementById('modal-text').textContent = text;
      const ok = document.getElementById('modal-ok');
      const cancel = document.getElementById('modal-cancel');
      ok.textContent = okLabel || 'Aceptar';
      modal.classList.remove('hidden');
      const close = v => { modal.classList.add('hidden'); ok.onclick = cancel.onclick = null; resolve(v); };
      ok.onclick = () => close(true);
      cancel.onclick = () => close(false);
    });
  }

  /* ---------------- Question rendering ---------------- */
  function questionHTML(q, order, selected, opts) {
    // opts: { reveal: bool, number, total, name }
    const reveal = opts.reveal;
    const multi = q.type === 'multi';
    const inputType = multi ? 'checkbox' : 'radio';
    const need = q.answer.length;
    let html = `<div class="q-meta">
      ${opts.number ? `<span>Pregunta ${opts.number}${opts.total ? ' / ' + opts.total : ''}</span>` : ''}
      ${opts.exam ? '' : `<span class="tag">${esc(dnamePlain(q.domain))}</span>`}
      ${multi ? `<span class="tag multi">Select ${need}${opts.exam && !settings.examSpanish ? '' : ' · Elige ' + need}</span>` : ''}
      ${opts.exam ? '' : `<span class="tag" title="Dificultad">${'●'.repeat(q.difficulty || 2)}${'○'.repeat(3 - (q.difficulty || 2))}</span>`}
    </div>
    <div class="q-text">${bi(q.q)}</div>
    <div class="options">`;
    order.forEach((orig, i) => {
      const isSel = selected.includes(orig);
      const isAns = q.answer.includes(orig);
      let cls = 'option';
      if (reveal) {
        cls += ' locked';
        if (isAns) cls += ' correct';
        else if (isSel) cls += ' wrong';
      } else if (isSel) cls += ' selected';
      html += `<label class="${cls}" data-orig="${orig}">
        <input type="${inputType}" name="${opts.name || 'opt'}" value="${orig}" ${isSel ? 'checked' : ''} ${reveal ? 'disabled' : ''}>
        <span class="letter">${LETTERS[i]}</span>
        <span class="body">${bi(q.options[orig])}</span>
      </label>`;
    });
    html += '</div>';
    if (reveal) {
      const ok = sameSet(selected, q.answer);
      const correctLetters = order.map((o, i) => (q.answer.includes(o) ? LETTERS[i] : null)).filter(Boolean).join(', ');
      html += `<div class="feedback ${ok ? 'ok' : 'bad'}">
        <strong>${ok ? '✓ Correct · Correcto' : '✗ Incorrect · Incorrecto'} — ${correctLetters}</strong>
        ${bi(q.explain, true)}
        ${q.ref ? `<div class="ref"><a href="${esc(q.ref)}" target="_blank" rel="noopener">Docs ↗</a></div>` : ''}
      </div>`;
    }
    return html;
  }

  function readSelection(container, q) {
    const inputs = container.querySelectorAll('.options input');
    const sel = [];
    inputs.forEach(inp => { if (inp.checked) sel.push(Number(inp.value)); });
    if (q.type !== 'multi' && sel.length > 1) return sel.slice(0, 1);
    return sel;
  }

  function bindOptionHighlight(container, q, onChange) {
    container.querySelectorAll('.options input').forEach(inp => {
      inp.addEventListener('change', () => {
        let sel = readSelection(container, q);
        // For multi questions, don't allow more than the number required
        if (q.type === 'multi' && sel.length > q.answer.length) {
          inp.checked = false;
          sel = readSelection(container, q);
        }
        container.querySelectorAll('.option').forEach(l => {
          l.classList.toggle('selected', sel.includes(Number(l.dataset.orig)));
        });
        onChange && onChange(sel);
      });
    });
  }

  /* ---------------- Views ---------------- */
  function viewHome() {
    const all = domainStats(null);
    const best = history.length ? Math.max(...history.map(h => h.score)) : null;
    const answeredPct = pct(all.answered, QUESTIONS.length);
    const saved = store.get('exam', null);
    app.innerHTML = `
      <h1>Claude Certified Developer – Foundations</h1>
      <p class="lead">Prepara el examen CCDV-F en inglés, con ayuda en español cuando la necesites.</p>
      ${saved ? `<div class="card notice">Tienes un simulacro a medias. <a href="#/examen/run">Continuar simulacro →</a></div>` : ''}
      <div class="grid">
        <div class="card"><div class="stat">${QUESTIONS.length}</div><div class="stat-label">preguntas en el banco</div></div>
        <div class="card"><div class="stat">${answeredPct}%</div><div class="stat-label">del banco respondido (${all.answered})</div></div>
        <div class="card"><div class="stat">${all.seen ? pct(all.correct, all.seen) + '%' : '—'}</div><div class="stat-label">acierto en práctica</div></div>
        <div class="card"><div class="stat">${best != null ? best : '—'}</div><div class="stat-label">mejor simulacro (aprobado: ${EXAM.pass})</div></div>
      </div>

      <h2>Cómo usar esta web</h2>
      <div class="card">
        <ol>
          <li><strong>Temario:</strong> lee cada área en modo <em>EN + ayuda</em>. Toca <span class="es-toggle" style="cursor:default">ES</span> solo cuando no entiendas una frase.</li>
          <li><strong>Glosario:</strong> aprende el vocabulario técnico y las frases típicas de las preguntas (<em>"Which approach is MOST cost-effective?"</em>).</li>
          <li><strong>Práctica:</strong> responde por áreas con corrección inmediata y explicación.</li>
          <li><strong>Simulacro:</strong> ${EXAM.total} preguntas, ${EXAM.minutes} minutos, solo en inglés. Repítelo hasta superar ${EXAM.pass} con margen (apunta a 800+).</li>
          <li><strong>Repaso:</strong> vuelve sobre las preguntas que has fallado.</li>
        </ol>
        <div class="btn-row">
          <a class="btn primary" href="#/temario">Empezar por el temario</a>
          <a class="btn" href="#/practica">Practicar</a>
          <a class="btn" href="#/examen">Hacer un simulacro</a>
        </div>
      </div>

      <h2>Progreso por área</h2>
      <div class="card">
        <table>
          <thead><tr><th>Área / Domain</th><th>Peso</th><th>Respondidas</th><th>Acierto</th></tr></thead>
          <tbody>
            ${DOMAINS.map(d => {
              const s = domainStats(d.id);
              const total = QUESTIONS.filter(q => q.domain === d.id).length;
              const acc = s.seen ? pct(s.correct, s.seen) : null;
              return `<tr>
                <td><a href="#/temario/${d.id}">${dnamePlain(d.id)}</a></td>
                <td>${d.weight}%</td>
                <td>${s.answered} / ${total}</td>
                <td style="min-width:120px">${acc == null ? '<span class="muted">—</span>' :
                  `<div class="bar ${acc >= 70 ? 'ok' : 'bad'}"><span style="width:${acc}%"></span></div><span class="small">${acc}%</span>`}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <h2>El examen en datos</h2>
      <div class="card">
        <ul>
          <li>${EXAM.total} preguntas aprox. de opción única y de respuesta múltiple (escenarios), ${EXAM.minutes} minutos.</li>
          <li>Puntuación escalada de 100 a 1.000; se aprueba con <strong>${EXAM.pass}</strong>.</li>
          <li>Solo en inglés y supervisado (Pearson VUE). No se permiten traductores del navegador.</li>
          <li>Reintentos: 14 días tras el 1.er suspenso, 30 tras el 2.º y 90 tras el 3.º (máx. 4 intentos en 12 meses).</li>
        </ul>
        <p class="small muted">La guía oficial del examen (Exam Guide) del Anthropic Partner Academy es la referencia definitiva sobre áreas y pesos.</p>
      </div>
      <div class="btn-row"><button class="btn ghost small" id="reset-progress">Borrar todo mi progreso</button></div>
    `;
    document.getElementById('reset-progress').onclick = async () => {
      if (await confirmBox('¿Seguro que quieres borrar estadísticas, historial y el simulacro en curso?', 'Borrar')) {
        stats = {}; history = [];
        store.del('stats'); store.del('history'); store.del('exam');
        render();
      }
    };
  }

  function viewSyllabus() {
    app.innerHTML = `
      <h1>Temario · Syllabus</h1>
      <p class="lead">Ocho áreas, ordenadas por peso en el examen. Dedica el tiempo en proporción al peso.</p>
      <div class="grid">
        ${DOMAINS.slice().sort((a, b) => b.weight - a.weight).map(d => `
          <a class="card domain-card" href="#/temario/${d.id}">
            <span class="weight">${d.weight}%</span>
            <strong>${esc(d.name.en)}</strong>
            <span class="muted small">${esc(d.name.es)}</span>
            <span class="small">${QUESTIONS.filter(q => q.domain === d.id).length} preguntas</span>
          </a>`).join('')}
      </div>`;
  }

  function viewDomain(id) {
    const d = DMAP.get(id);
    if (!d) { app.innerHTML = '<div class="empty">Área no encontrada.</div>'; return; }
    app.innerHTML = `
      <p class="small"><a href="#/temario">← Temario</a></p>
      <h1>${bi(d.name)}</h1>
      <p><span class="weight">${d.weight}% del examen</span></p>
      <div class="card">${bi(d.summary, true)}</div>
      ${settings.lang === 'help' ? '<div class="btn-row"><button class="btn small" id="show-all-es">Mostrar todas las traducciones</button></div>' : ''}
      ${d.lessons.map(l => `
        <section class="lesson">
          <h3>${bi(l.title)}</h3>
          ${bi(l.body, true)}
          ${l.code ? `<pre><code>${esc(l.code)}</code></pre>` : ''}
        </section>`).join('')}
      ${d.keyFacts && d.keyFacts.length ? `
        <div class="keyfacts">
          <h3>Key facts to memorise · Datos clave</h3>
          <ul>${d.keyFacts.map(k => `<li>${bi(k)}</li>`).join('')}</ul>
        </div>` : ''}
      ${d.docs && d.docs.length ? `<h3>Official docs</h3><ul>${d.docs.map(u => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(u.replace(/^https?:\/\//, ''))}</a></li>`).join('')}</ul>` : ''}
      <div class="btn-row">
        <button class="btn primary" id="practice-domain">Practicar esta área</button>
      </div>`;
    document.getElementById('practice-domain').onclick = () => startPractice({ domain: id, count: 10, onlyNew: false, onlyFailed: false });
    const all = document.getElementById('show-all-es');
    if (all) all.onclick = () => {
      const blocks = app.querySelectorAll('.bi');
      const anyHidden = Array.from(blocks).some(b => !b.classList.contains('show-es'));
      blocks.forEach(b => b.classList.toggle('show-es', anyHidden));
      all.textContent = anyHidden ? 'Ocultar traducciones' : 'Mostrar todas las traducciones';
    };
  }

  function viewGlossary() {
    app.innerHTML = `
      <h1>Glosario · Glossary</h1>
      <p class="lead">Vocabulario técnico y frases que aparecen en las preguntas del examen.</p>
      <div class="field"><input type="search" id="gsearch" placeholder="Buscar término (EN o ES)…"></div>
      <h2>Exam English: frases típicas</h2>
      <div class="card" id="phrases">
        ${GLOSSARY.phrases.map(p => `<div class="glossary-item"><span class="term">${esc(p.en)}</span><span class="tr">${esc(p.es)}</span>${p.note ? `<div class="small muted">${esc(p.note)}</div>` : ''}</div>`).join('')}
      </div>
      <h2>Términos técnicos</h2>
      <div class="card" id="terms"></div>`;
    const termsEl = document.getElementById('terms');
    const draw = filter => {
      const f = (filter || '').trim().toLowerCase();
      const list = GLOSSARY.terms
        .filter(t => !f || (t.term + ' ' + t.es + ' ' + t.def.en + ' ' + t.def.es).toLowerCase().includes(f))
        .sort((a, b) => a.term.localeCompare(b.term));
      termsEl.innerHTML = list.length ? list.map(t => `
        <div class="glossary-item">
          <span class="term">${esc(t.term)}</span><span class="tr">${esc(t.es)}</span>
          <div>${bi(t.def)}</div>
        </div>`).join('') : '<div class="empty">Sin resultados.</div>';
    };
    draw('');
    document.getElementById('gsearch').addEventListener('input', e => draw(e.target.value));
  }

  /* ---------------- Practice ---------------- */
  function viewPracticeSetup() {
    app.innerHTML = `
      <h1>Práctica · Practice</h1>
      <p class="lead">Corrección inmediata con explicación después de cada pregunta.</p>
      <div class="card">
        <div class="field"><label for="p-domain">Área</label>
          <select id="p-domain">
            <option value="">Todas las áreas (según su peso)</option>
            ${DOMAINS.map(d => `<option value="${d.id}">${esc(d.name.en)} — ${esc(d.name.es)} (${QUESTIONS.filter(q => q.domain === d.id).length})</option>`).join('')}
          </select>
        </div>
        <div class="field"><label for="p-count">Número de preguntas</label>
          <input type="number" id="p-count" min="1" max="${QUESTIONS.length}" value="10">
        </div>
        <label class="check"><input type="checkbox" id="p-new"> Solo preguntas que no he respondido nunca</label>
        <label class="check"><input type="checkbox" id="p-failed"> Solo preguntas que fallé la última vez</label>
        <div class="btn-row"><button class="btn primary" id="p-start">Empezar</button></div>
      </div>
      <p class="small muted">Atajos de teclado: A–F para elegir opción, Enter para comprobar / siguiente.</p>`;
    document.getElementById('p-start').onclick = () => startPractice({
      domain: document.getElementById('p-domain').value,
      count: Math.max(1, parseInt(document.getElementById('p-count').value, 10) || 10),
      onlyNew: document.getElementById('p-new').checked,
      onlyFailed: document.getElementById('p-failed').checked
    });
  }

  function startPractice(cfg) {
    let pool = QUESTIONS.filter(q => !cfg.domain || q.domain === cfg.domain);
    if (cfg.ids) pool = cfg.ids.map(id => QMAP.get(id)).filter(Boolean);
    if (cfg.onlyNew) pool = pool.filter(q => !stats[q.id]);
    if (cfg.onlyFailed) pool = pool.filter(q => stats[q.id] && stats[q.id].last === false);
    if (!pool.length) {
      app.innerHTML = `<div class="empty">No hay preguntas con esos filtros.<div class="btn-row" style="justify-content:center"><button class="btn" id="back-empty">Volver</button></div></div>`;
      document.getElementById('back-empty').onclick = () => { location.hash = '#/practica'; render(); };
      return;
    }
    const picked = shuffle(pool).slice(0, Math.min(cfg.count || pool.length, pool.length));
    practice = {
      items: picked.map(q => ({ id: q.id, order: shuffle(q.options.map((_, i) => i)) })),
      idx: 0, selected: [], revealed: false, correct: 0, done: 0
    };
    if (location.hash === '#/practica/run') render(); else location.hash = '#/practica/run';
  }

  function viewPracticeRun() {
    if (!practice) { location.hash = '#/practica'; return; }
    const p = practice;
    if (p.idx >= p.items.length) {
      app.innerHTML = `
        <div class="card result-hero ${pct(p.correct, p.done) >= 70 ? 'pass' : 'fail'}">
          <div class="score">${p.correct} / ${p.done}</div>
          <p>${pct(p.correct, p.done)}% de acierto</p>
          <div class="btn-row" style="justify-content:center">
            <a class="btn primary" href="#/practica">Otra sesión</a>
            <a class="btn" href="#/repaso">Repasar fallos</a>
          </div>
        </div>`;
      return;
    }
    const item = p.items[p.idx];
    const q = QMAP.get(item.id);
    app.innerHTML = `
      <div class="q-meta"><a href="#/practica">← Salir</a><span>Aciertos: ${p.correct} / ${p.done}</span></div>
      <div class="card" id="qcard">${questionHTML(q, item.order, p.selected, { reveal: p.revealed, number: p.idx + 1, total: p.items.length, name: 'p' })}</div>
      <div class="btn-row">
        ${p.revealed
          ? `<button class="btn primary" id="next">${p.idx + 1 < p.items.length ? 'Siguiente →' : 'Ver resultado'}</button>`
          : `<button class="btn primary" id="check" ${p.selected.length === q.answer.length ? '' : 'disabled'}>Comprobar</button>`}
      </div>`;
    const card = document.getElementById('qcard');
    if (!p.revealed) {
      bindOptionHighlight(card, q, sel => {
        p.selected = sel;
        document.getElementById('check').disabled = sel.length !== q.answer.length;
      });
      document.getElementById('check').onclick = () => {
        const ok = sameSet(p.selected, q.answer);
        p.revealed = true; p.done++; if (ok) p.correct++;
        recordAnswer(q.id, ok);
        render();
      };
    } else {
      document.getElementById('next').onclick = () => {
        p.idx++; p.selected = []; p.revealed = false; render();
      };
    }
  }

  /* ---------------- Exam ---------------- */
  function buildExam() {
    const byDomain = {};
    DOMAINS.forEach(d => { byDomain[d.id] = shuffle(QUESTIONS.filter(q => q.domain === d.id)); });
    const totalWeight = DOMAINS.reduce((s, d) => s + d.weight, 0);
    const total = Math.min(EXAM.total, QUESTIONS.length);
    // Largest-remainder apportionment by weight, capped by bank size
    let quotas = DOMAINS.map(d => {
      const exact = (d.weight / totalWeight) * total;
      return { id: d.id, n: Math.floor(exact), rem: exact - Math.floor(exact) };
    });
    let assigned = quotas.reduce((s, x) => s + x.n, 0);
    quotas.slice().sort((a, b) => b.rem - a.rem).forEach(x => { if (assigned < total) { x.n++; assigned++; } });
    quotas.forEach(x => { x.n = Math.min(x.n, byDomain[x.id].length); });
    assigned = quotas.reduce((s, x) => s + x.n, 0);
    while (assigned < total) {
      const spare = quotas.filter(x => byDomain[x.id].length > x.n).sort((a, b) => DMAP.get(b.id).weight - DMAP.get(a.id).weight)[0];
      if (!spare) break;
      spare.n++; assigned++;
    }
    let picked = [];
    quotas.forEach(x => { picked = picked.concat(byDomain[x.id].slice(0, x.n)); });
    picked = shuffle(picked);
    return {
      startedAt: Date.now(),
      durationMs: EXAM.minutes * 60 * 1000,
      items: picked.map(q => ({ id: q.id, order: shuffle(q.options.map((_, i) => i)) })),
      answers: {},
      flags: [],
      current: 0
    };
  }

  function viewExamIntro() {
    const saved = store.get('exam', null);
    app.innerHTML = `
      <h1>Simulacro de examen · Mock exam</h1>
      <p class="lead">Condiciones parecidas al examen real: ${EXAM.total} preguntas, ${EXAM.minutes} minutos, sin corrección hasta el final.</p>
      ${saved ? `<div class="card notice">Hay un simulacro en curso (${Object.keys(saved.answers).length}/${saved.items.length} respondidas).
        <div class="btn-row"><a class="btn primary" href="#/examen/run">Continuar</a><button class="btn" id="discard">Descartar</button></div></div>` : ''}
      <div class="card">
        <ul>
          <li>Las preguntas se eligen al azar respetando el peso de cada área.</li>
          <li>Puedes marcar preguntas (<em>flag</em>) y volver a ellas antes de entregar.</li>
          <li>En las de respuesta múltiple se indica cuántas opciones elegir; puntúan solo si aciertas todas.</li>
          <li>La nota se muestra en escala 100–1.000 (aproximación lineal; Anthropic no publica su fórmula de escalado).</li>
          <li>Si cierras la pestaña, el simulacro y el tiempo se conservan en este navegador.</li>
        </ul>
        <label class="check"><input type="checkbox" id="exam-es" ${settings.examSpanish ? 'checked' : ''}> Permitir ayuda en español durante el simulacro (desactívalo en las últimas semanas)</label>
        <div class="btn-row"><button class="btn primary" id="start-exam">Empezar simulacro nuevo</button></div>
      </div>
      ${history.length ? `
        <h2>Historial</h2>
        <div class="card"><table>
          <thead><tr><th>Fecha</th><th>Nota</th><th>Aciertos</th><th>Tiempo</th><th></th></tr></thead>
          <tbody>${history.slice().reverse().map(h => `<tr>
            <td>${fmtDate(h.date)}</td>
            <td><strong style="color:var(--${h.score >= EXAM.pass ? 'ok' : 'bad'})">${h.score}</strong></td>
            <td>${h.correct}/${h.total}</td>
            <td>${fmtTime(h.timeUsed)}</td>
            <td>${h.score >= EXAM.pass ? 'PASS' : 'FAIL'}</td></tr>`).join('')}</tbody>
        </table></div>` : ''}`;
    document.getElementById('exam-es').onchange = e => { settings.examSpanish = e.target.checked; saveSettings(); };
    const discard = document.getElementById('discard');
    if (discard) discard.onclick = async () => {
      if (await confirmBox('¿Descartar el simulacro en curso? No se guardará la nota.', 'Descartar')) { store.del('exam'); render(); }
    };
    document.getElementById('start-exam').onclick = async () => {
      if (store.get('exam', null) && !(await confirmBox('Ya tienes un simulacro en curso. ¿Empezar uno nuevo y descartar el anterior?', 'Empezar nuevo'))) return;
      store.set('exam', buildExam());
      location.hash = '#/examen/run';
    };
  }

  function viewExamRun() {
    const ex = store.get('exam', null);
    if (!ex) { location.hash = '#/examen'; return; }
    inExam = true;
    const item = ex.items[ex.current];
    const q = QMAP.get(item.id);
    if (!q) { store.del('exam'); location.hash = '#/examen'; return; }
    const sel = ex.answers[ex.current] || [];
    const flagged = ex.flags.includes(ex.current);
    const answeredCount = Object.keys(ex.answers).filter(k => (ex.answers[k] || []).length).length;
    app.innerHTML = `
      <div class="exam-bar">
        <span class="timer" id="timer">--:--</span>
        <span class="muted small">${answeredCount}/${ex.items.length} answered</span>
        <span style="flex:1"></span>
        <button class="btn" id="flag">${flagged ? '⚑ Unflag' : '⚐ Flag'}</button>
        <button class="btn primary" id="finish">Submit exam</button>
      </div>
      <div class="card" id="qcard">${questionHTML(q, item.order, sel, { reveal: false, number: ex.current + 1, total: ex.items.length, name: 'e', exam: true })}</div>
      <div class="btn-row">
        <button class="btn" id="prev" ${ex.current === 0 ? 'disabled' : ''}>← Previous</button>
        <button class="btn primary" id="next" ${ex.current === ex.items.length - 1 ? 'disabled' : ''}>Next →</button>
      </div>
      <div class="navgrid">${ex.items.map((_, i) => {
        let cls = '';
        if ((ex.answers[i] || []).length) cls += ' answered';
        if (ex.flags.includes(i)) cls += ' flagged';
        if (i === ex.current) cls += ' current';
        return `<button class="${cls.trim()}" data-go="${i}">${i + 1}</button>`;
      }).join('')}</div>
      <p class="small muted">Gris = respondida · Borde amarillo = marcada · ${settings.examSpanish ? 'Ayuda en español activada' : 'Solo inglés'}</p>`;

    const save = () => store.set('exam', ex);
    bindOptionHighlight(document.getElementById('qcard'), q, s => { ex.answers[ex.current] = s; save(); });
    const go = i => { ex.current = i; save(); render(); };
    document.getElementById('prev').onclick = () => go(ex.current - 1);
    document.getElementById('next').onclick = () => go(ex.current + 1);
    document.getElementById('flag').onclick = () => {
      ex.flags = flagged ? ex.flags.filter(f => f !== ex.current) : ex.flags.concat(ex.current);
      save(); render();
    };
    app.querySelectorAll('[data-go]').forEach(b => { b.onclick = () => go(Number(b.dataset.go)); });
    document.getElementById('finish').onclick = async () => {
      const unanswered = ex.items.length - answeredCount;
      const msg = unanswered
        ? `Te quedan ${unanswered} preguntas sin responder${ex.flags.length ? ' y ' + ex.flags.length + ' marcadas' : ''}. ¿Entregar el examen?`
        : (ex.flags.length ? `Tienes ${ex.flags.length} preguntas marcadas. ¿Entregar el examen?` : '¿Entregar el examen?');
      if (await confirmBox(msg, 'Entregar')) finishExam(ex);
    };
    startTimer(ex);
  }

  function startTimer(ex) {
    stopTimer();
    const tick = () => {
      const left = ex.startedAt + ex.durationMs - Date.now();
      const el = document.getElementById('timer');
      if (!el) { stopTimer(); return; }
      el.textContent = fmtTime(left);
      el.classList.toggle('low', left < 10 * 60 * 1000);
      if (left <= 0) { stopTimer(); finishExam(store.get('exam', ex)); }
    };
    tick();
    timerHandle = setInterval(tick, 1000);
  }
  function stopTimer() { if (timerHandle) { clearInterval(timerHandle); timerHandle = null; } }

  function finishExam(ex) {
    stopTimer();
    let correct = 0;
    const byDomain = {};
    const items = ex.items.map((it, i) => {
      const q = QMAP.get(it.id);
      const sel = ex.answers[i] || [];
      const ok = !!q && sameSet(sel, q.answer);
      if (q) {
        byDomain[q.domain] = byDomain[q.domain] || { c: 0, t: 0 };
        byDomain[q.domain].t++;
        if (ok) { byDomain[q.domain].c++; correct++; }
        recordAnswer(q.id, ok);
      }
      return { id: it.id, order: it.order, sel, ok };
    });
    const total = ex.items.length;
    const result = {
      date: Date.now(), correct, total, score: scaled(correct, total),
      timeUsed: Math.min(Date.now() - ex.startedAt, ex.durationMs), byDomain
    };
    history.push(result);
    history = history.slice(-30);
    store.set('history', history);
    store.del('exam');
    lastResult = Object.assign({ items }, result);
    inExam = false;
    location.hash = '#/examen/resultado';
  }

  function viewExamResult() {
    const r = lastResult;
    if (!r) { location.hash = '#/examen'; return; }
    const pass = r.score >= EXAM.pass;
    app.innerHTML = `
      <div class="card result-hero ${pass ? 'pass' : 'fail'}">
        <div class="score">${r.score}</div>
        <p><strong>${pass ? 'PASS · Aprobado' : 'FAIL · Suspenso'}</strong> — ${r.correct}/${r.total} correctas (${pct(r.correct, r.total)}%) · tiempo ${fmtTime(r.timeUsed)}</p>
        <p class="small muted">Para ir con margen al examen real, apunta a 800+ de forma constante.</p>
      </div>
      <h2>Resultado por área</h2>
      <div class="card"><table>
        <thead><tr><th>Área</th><th>Aciertos</th><th></th></tr></thead>
        <tbody>${DOMAINS.filter(d => r.byDomain[d.id]).map(d => {
          const b = r.byDomain[d.id]; const p = pct(b.c, b.t);
          return `<tr><td><a href="#/temario/${d.id}">${dnamePlain(d.id)}</a></td><td>${b.c}/${b.t}</td>
            <td style="min-width:140px"><div class="bar ${p >= 70 ? 'ok' : 'bad'}"><span style="width:${p}%"></span></div></td></tr>`;
        }).join('')}</tbody>
      </table></div>
      <h2>Revisión de respuestas</h2>
      <label class="check"><input type="checkbox" id="only-wrong" checked> Mostrar solo las falladas</label>
      <div id="review"></div>
      <div class="btn-row"><a class="btn primary" href="#/examen">Volver a simulacros</a><a class="btn" href="#/repaso">Ir a repaso</a></div>`;
    const draw = onlyWrong => {
      document.getElementById('review').innerHTML = r.items.map((it, i) => {
        if (onlyWrong && it.ok) return '';
        const q = QMAP.get(it.id);
        if (!q) return '';
        return `<div class="card">${questionHTML(q, it.order, it.sel, { reveal: true, number: i + 1, total: r.total, name: 'r' + i })}</div>`;
      }).join('') || '<div class="empty">¡Sin fallos! 🎉</div>';
    };
    draw(true);
    document.getElementById('only-wrong').onchange = e => draw(e.target.checked);
  }

  /* ---------------- Review ---------------- */
  function viewReview() {
    const failed = QUESTIONS.filter(q => stats[q.id] && stats[q.id].last === false);
    const weak = DOMAINS.map(d => {
      const s = domainStats(d.id);
      return { d, acc: s.seen ? pct(s.correct, s.seen) : null };
    }).filter(x => x.acc != null).sort((a, b) => a.acc - b.acc);
    app.innerHTML = `
      <h1>Repaso · Review</h1>
      <p class="lead">Preguntas cuya última respuesta fue incorrecta. Cuando las aciertes, saldrán de esta lista.</p>
      ${weak.length ? `<div class="card"><strong>Tus áreas más débiles:</strong>
        <ul>${weak.slice(0, 3).map(w => `<li><a href="#/temario/${w.d.id}">${dnamePlain(w.d.id)}</a> — ${w.acc}%</li>`).join('')}</ul></div>` : ''}
      ${failed.length ? `
        <div class="btn-row"><button class="btn primary" id="practice-failed">Practicar las ${failed.length} falladas</button></div>
        <h2>Lista</h2>
        <div class="card"><table><thead><tr><th>Área</th><th>Pregunta</th><th>Intentos</th></tr></thead><tbody>
        ${failed.map(q => `<tr><td class="small">${dnamePlain(q.domain)}</td><td>${esc(q.q.en.replace(/<[^>]+>/g, '')).slice(0, 140)}${q.q.en.length > 140 ? '…' : ''}</td><td>${stats[q.id].correct}/${stats[q.id].seen}</td></tr>`).join('')}
        </tbody></table></div>`
      : '<div class="empty">No tienes preguntas falladas pendientes. Haz una sesión de práctica o un simulacro.</div>'}`;
    const btn = document.getElementById('practice-failed');
    if (btn) btn.onclick = () => startPractice({ ids: failed.map(q => q.id), count: failed.length });
  }

  /* ---------------- Router ---------------- */
  function render() {
    const hash = location.hash || '#/';
    const parts = hash.replace(/^#\/?/, '').split('/');
    if (!(parts[0] === 'examen' && parts[1] === 'run')) { inExam = false; stopTimer(); }
    document.querySelectorAll('[data-nav]').forEach(a => {
      a.classList.toggle('active', (a.dataset.nav === 'home' && !parts[0]) || a.dataset.nav === parts[0]);
    });
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('active', b.dataset.lang === settings.lang));
    switch (parts[0]) {
      case '': viewHome(); break;
      case 'temario': parts[1] ? viewDomain(parts[1]) : viewSyllabus(); break;
      case 'glosario': viewGlossary(); break;
      case 'practica': parts[1] === 'run' ? viewPracticeRun() : viewPracticeSetup(); break;
      case 'examen':
        if (parts[1] === 'run') viewExamRun();
        else if (parts[1] === 'resultado') viewExamResult();
        else viewExamIntro();
        break;
      case 'repaso': viewReview(); break;
      default: viewHome();
    }
  }

  /* ---------------- Global events ---------------- */
  document.addEventListener('click', e => {
    const t = e.target.closest('.es-toggle');
    if (t && t.tagName === 'BUTTON') {
      e.preventDefault(); e.stopPropagation();
      t.closest('.bi').classList.toggle('show-es');
    }
  }, true);

  document.querySelectorAll('[data-lang]').forEach(b => {
    b.addEventListener('click', () => { settings.lang = b.dataset.lang; saveSettings(); render(); });
  });

  document.addEventListener('keydown', e => {
    if (e.target.matches('input[type="number"], input[type="search"], select')) return;
    const route = location.hash;
    if (!/^#\/(practica\/run|examen\/run)/.test(route)) return;
    const k = e.key.toUpperCase();
    const idx = LETTERS.indexOf(k);
    if (idx >= 0 && k.length === 1) {
      const inputs = app.querySelectorAll('.options input:not([disabled])');
      if (inputs[idx]) { inputs[idx].click(); e.preventDefault(); }
    } else if (e.key === 'Enter') {
      const btn = document.getElementById('check') || document.getElementById('next');
      if (btn && !btn.disabled) { btn.click(); e.preventDefault(); }
    }
  });

  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  render();
})();
