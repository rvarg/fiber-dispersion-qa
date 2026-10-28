(() => {
  'use strict';

  // ---------- Estado ----------
  const state = {
    sessions: [],        // lista resumida (id, number, title, description, questionCount)
    session: null,       // sesión abierta (con sus preguntas, sin respuestas)
    queue: [],           // preguntas de la sesión en el orden en que se mostrarán
    index: -1,           // posición actual dentro de queue
    current: null,       // queue[index]
    answered: false,
    correctCount: 0,
    token: 0             // cambia al abrir/cerrar una sesión: descarta respuestas de red tardías
  };

  // ---------- Referencias DOM ----------
  const $ = id => document.getElementById(id);

  const screens = {
    sessions: $('screen-sessions'),
    quiz: $('screen-quiz'),
    complete: $('screen-complete'),
    error: $('screen-error')
  };

  const el = {
    heroEyebrow: $('hero-eyebrow'),
    heroTitle: $('hero-title'),
    heroSubtitle: $('hero-subtitle'),
    sessionsLabel: $('sessions-label'),
    sessionList: $('session-list'),

    btnBack: $('btn-back'),
    progressPill: $('progress-pill'),
    progressBar: $('progress-bar'),
    qSessionTag: $('q-session-tag'),
    qTypeTag: $('q-type-tag'),
    qPrompt: $('q-prompt'),
    figure: $('q-figure'),
    figureBtn: $('q-figure-btn'),
    qImage: $('q-image'),
    qCaption: $('q-caption'),
    options: $('mcq-options'),
    calcAnswer: $('calc-answer'),
    calcInput: $('calc-input'),
    calcUnit: $('calc-unit'),
    calcError: $('calc-error'),
    calcHint: $('calc-hint'),
    btnHint: $('btn-hint'),
    btnCheck: $('btn-check'),
    feedback: $('feedback'),
    btnNext: $('btn-next'),

    completeScore: $('complete-score'),
    completeSession: $('complete-session'),
    btnNextSession: $('btn-next-session'),
    btnRepeat: $('btn-repeat'),
    btnCompleteBack: $('btn-complete-back'),

    errorTitle: $('error-title'),
    errorDesc: $('error-desc'),
    btnRetry: $('btn-retry'),

    lightbox: $('lightbox'),
    lightboxImg: $('lightbox-img')
  };

  const DEFAULT_ERROR = {
    title: 'No se pudo cargar el contenido',
    desc: 'Verifica tu conexión y que la dirección del servidor configurada en config.js sea correcta.'
  };

  // ---------- Utilidades ----------
  function showScreen(name) {
    Object.entries(screens).forEach(([key, node]) => {
      node.classList.toggle('hidden', key !== name);
    });
  }

  function showError(title, desc) {
    el.errorTitle.textContent = title || DEFAULT_ERROR.title;
    el.errorDesc.textContent = desc || DEFAULT_ERROR.desc;
    showScreen('error');
  }

  async function api(path, options) {
    const res = await fetch(`${API_BASE_URL}${path}`, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // Fisher-Yates: baraja una copia, no muta el original
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
  }

  // ---------- Encabezado (textos editables en server/data/app.json) ----------
  async function loadConfig() {
    try {
      const cfg = await api('/config');
      if (cfg.eyebrow) el.heroEyebrow.textContent = cfg.eyebrow;
      if (cfg.title) {
        el.heroTitle.textContent = cfg.title;
        document.title = cfg.title;
      }
      if (cfg.subtitle) el.heroSubtitle.textContent = cfg.subtitle;
      if (cfg.sessionsLabel) el.sessionsLabel.textContent = cfg.sessionsLabel;
    } catch (err) {
      // Si falla, se quedan los textos de respaldo del HTML; no es crítico.
    }
  }

  // ---------- Lista de sesiones ----------
  async function loadSessions() {
    try {
      state.sessions = await api('/sessions');
    } catch (err) {
      showError();
      return;
    }
    if (!state.sessions.length) {
      showError(
        'Aún no hay temas disponibles',
        'El servidor no encontró sesiones válidas. Revisa los archivos de server/data/sessions (puedes ejecutar «npm run validate»).'
      );
      return;
    }
    renderSessions();
    showScreen('sessions');
  }

  function renderSessions() {
    el.sessionList.innerHTML = '';
    state.sessions.forEach(s => {
      const row = document.createElement('div');
      row.className = 'session-row';
      row.setAttribute('role', 'listitem');
      row.tabIndex = 0;

      const badge = document.createElement('span');
      badge.className = 'session-row__badge';
      badge.textContent = String(s.number);

      const body = document.createElement('span');
      body.className = 'session-row__body';

      const name = document.createElement('p');
      name.className = 'session-row__name';
      name.textContent = s.title;
      body.appendChild(name);

      if (s.description) {
        const desc = document.createElement('p');
        desc.className = 'session-row__desc';
        desc.textContent = s.description;
        body.appendChild(desc);
      }

      const count = document.createElement('p');
      count.className = 'session-row__count';
      count.textContent = plural(s.questionCount, 'pregunta', 'preguntas');
      body.appendChild(count);

      const chevron = document.createElement('span');
      chevron.className = 'chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';

      row.append(badge, body, chevron);
      row.addEventListener('click', () => startSession(s.id));
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startSession(s.id);
        }
      });
      el.sessionList.appendChild(row);
    });
  }

  // ---------- Flujo de la sesión ----------
  // Se trae la sesión completa una sola vez; cada pregunta se muestra una
  // vez, sin repetirse, y al terminar se pasa a la pantalla de resultados.
  async function startSession(sessionId) {
    const token = ++state.token;
    showScreen('quiz');
    el.qPrompt.textContent = 'Cargando preguntas…';
    el.options.innerHTML = '';
    el.calcAnswer.classList.add('hidden');
    clearFigure();
    el.feedback.classList.add('hidden');
    el.btnNext.classList.add('hidden');
    el.progressPill.textContent = 'Pregunta 0 de 0';
    el.progressBar.style.width = '0%';

    let session;
    try {
      session = await api(`/sessions/${encodeURIComponent(sessionId)}`);
    } catch (err) {
      if (token === state.token) showError();
      return;
    }
    if (token !== state.token) return;

    if (!session.questions.length) {
      showError('Esta sesión no tiene preguntas', 'Revisa el archivo de la sesión en server/data/sessions.');
      return;
    }

    state.session = session;
    state.queue = session.shuffleQuestions ? shuffle(session.questions) : session.questions.slice();
    state.index = -1;
    state.correctCount = 0;
    el.qSessionTag.textContent = `Sesión ${session.number}`;
    goToNextQuestion();
  }

  function setProgress(done) {
    const total = state.queue.length;
    el.progressBar.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
  }

  function goToNextQuestion() {
    state.index += 1;
    if (state.index >= state.queue.length) {
      showCompletion();
      return;
    }
    state.answered = false;
    state.current = state.queue[state.index];

    el.progressPill.textContent = `Pregunta ${state.index + 1} de ${state.queue.length}`;
    setProgress(state.index);
    renderQuestion(state.current);

    el.feedback.classList.add('hidden');
    el.feedback.textContent = '';
    el.btnNext.classList.add('hidden');
    if (state.index > 0) screens.quiz.scrollIntoView({ block: 'start' });
  }

  function showCompletion() {
    const total = state.queue.length;
    el.completeScore.textContent = `${state.correctCount} de ${total} correctas`;
    el.completeSession.textContent = `Sesión ${state.session.number}: ${state.session.title}`;

    const pos = state.sessions.findIndex(s => s.id === state.session.id);
    const next = pos >= 0 ? state.sessions[pos + 1] : null;
    el.btnNextSession.classList.toggle('hidden', !next);
    el.btnNextSession.dataset.sessionId = next ? next.id : '';

    setProgress(total);
    showScreen('complete');
  }

  // ---------- Imagen de la pregunta ----------
  function clearFigure() {
    el.figure.classList.add('hidden');
    el.qImage.removeAttribute('src');
    el.qImage.alt = '';
    el.qImage.onerror = null;
    el.qCaption.textContent = '';
    el.figureBtn.classList.remove('hidden');
    const old = el.figure.querySelector('.question-figure__error');
    if (old) old.remove();
  }

  function renderFigure(image) {
    clearFigure();
    if (!image || !image.url) return;

    el.figure.classList.remove('hidden');
    el.qCaption.textContent = image.caption || '';
    el.qImage.alt = image.alt || '';
    el.qImage.onerror = () => {
      el.figureBtn.classList.add('hidden');
      const note = document.createElement('p');
      note.className = 'question-figure__error';
      note.textContent = 'No se pudo cargar la imagen. Si no hay conexión a internet, las imágenes alojadas en la web no se pueden mostrar.';
      el.figure.insertBefore(note, el.qCaption);
    };
    el.qImage.src = image.url;
  }

  function openLightbox() {
    if (!el.qImage.getAttribute('src')) return;
    el.lightboxImg.src = el.qImage.currentSrc || el.qImage.src;
    el.lightboxImg.alt = el.qImage.alt;
    el.lightbox.classList.remove('hidden');
  }

  function closeLightbox() {
    el.lightbox.classList.add('hidden');
    el.lightboxImg.removeAttribute('src');
  }

  // ---------- Pregunta ----------
  // Muestra un número con coma decimal (estilo español) y sin ceros sobrantes
  function numEs(n) {
    return String(Number(Number(n).toPrecision(8))).replace('.', ',');
  }

  function renderQuestion(q) {
    el.qPrompt.textContent = q.prompt;
    renderFigure(q.image);

    el.options.innerHTML = '';
    el.options.classList.add('hidden');
    el.calcAnswer.classList.add('hidden');

    if (q.type === 'calc') {
      el.qTypeTag.textContent = 'Cálculo';
      el.calcAnswer.classList.remove('hidden');
      el.calcInput.value = '';
      el.calcInput.disabled = false;
      el.calcUnit.textContent = q.unit || '';
      hideCalcError();
      el.btnCheck.classList.remove('hidden');
      el.btnCheck.disabled = false;
      el.calcHint.classList.add('hidden');
      el.calcHint.textContent = q.hint || '';
      el.btnHint.textContent = 'Ver pista';
      el.btnHint.classList.toggle('hidden', !q.hint);
      return;
    }

    el.qTypeTag.textContent = 'Opción múltiple';
    el.options.classList.remove('hidden');
    q.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option-btn';
      btn.dataset.optionId = opt.id;

      const marker = document.createElement('span');
      marker.className = 'option-btn__marker';
      marker.textContent = opt.id.toUpperCase();

      const text = document.createElement('span');
      text.textContent = opt.text;

      btn.append(marker, text);
      btn.addEventListener('click', () => selectOption(opt.id, btn));
      el.options.appendChild(btn);
    });
  }

  function hideCalcError() {
    el.calcError.textContent = '';
    el.calcError.classList.add('hidden');
  }

  function showCalcError(msg) {
    el.calcError.textContent = msg;
    el.calcError.classList.remove('hidden');
  }

  function checkUrl(question) {
    return `/sessions/${encodeURIComponent(state.session.id)}/questions/${encodeURIComponent(question.id)}/check`;
  }

  // Construye el recuadro de retroalimentación (solo con textContent: sin HTML)
  function renderFeedback(result, userValueText) {
    const fb = el.feedback;
    fb.className = `feedback ${result.correct ? 'is-correct' : 'is-incorrect'}`;
    fb.textContent = '';

    const add = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      node.textContent = text;
      fb.appendChild(node);
      return node;
    };

    add('p', 'feedback__verdict', result.correct ? '¡Correcto!' : 'No es correcto');

    if (result.type === 'calc') {
      const unit = result.unit ? ` ${result.unit}` : '';
      add('p', 'feedback__answer', `Respuesta: ${result.correctAnswerText.replace('.', ',')}${unit}`);
      if (!result.correct && userValueText) {
        add('p', 'feedback__yours', `Tu respuesta: ${userValueText}${unit}`);
      }
      if (result.solution && result.solution.length) {
        add('p', 'feedback__subtitle', 'Solución paso a paso');
        const ol = document.createElement('ol');
        ol.className = 'feedback__steps';
        result.solution.forEach(step => {
          const li = document.createElement('li');
          li.textContent = step;
          ol.appendChild(li);
        });
        fb.appendChild(ol);
      }
    }

    if (result.explanation) add('p', 'feedback__body', result.explanation);
    if (result.reference) add('p', 'feedback__ref', `Para repasar: ${result.reference}`);
    fb.classList.remove('hidden');

    setProgress(state.index + 1);
    el.btnNext.textContent = state.index + 1 >= state.queue.length ? 'Ver resultado →' : 'Siguiente pregunta →';
    el.btnNext.classList.remove('hidden');
  }

  async function selectOption(optionId, btnEl) {
    if (state.answered) return;
    state.answered = true;
    const token = state.token;
    const question = state.current;

    let result;
    try {
      result = await api(checkUrl(question), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId })
      });
    } catch (err) {
      if (token === state.token) {
        state.answered = false; // permite reintentar sin perder la pregunta
        showError();
      }
      return;
    }
    if (token !== state.token || question !== state.current) return;

    if (result.correct) state.correctCount += 1;

    Array.from(el.options.children).forEach(node => {
      node.disabled = true;
      if (node.dataset.optionId === result.correctOptionId) {
        node.classList.add('is-correct');
      } else if (node === btnEl) {
        node.classList.add('is-incorrect');
      } else {
        node.classList.add('is-faded');
      }
    });

    renderFeedback(result);
  }

  async function checkCalc() {
    if (state.answered) return;
    const raw = el.calcInput.value.trim();
    if (!raw) {
      showCalcError('Escribe un número para comprobar tu respuesta.');
      return;
    }
    hideCalcError();

    state.answered = true;
    const token = state.token;
    const question = state.current;

    let res;
    try {
      res = await fetch(`${API_BASE_URL}${checkUrl(question)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: raw })
      });
    } catch (err) {
      if (token === state.token) {
        state.answered = false;
        showError();
      }
      return;
    }
    if (token !== state.token || question !== state.current) return;

    if (res.status === 400) {
      // No es un número: no cuenta como intento, se puede corregir
      state.answered = false;
      showCalcError('Escribe solo un número (puedes usar coma o punto decimal, p. ej. 0,35).');
      return;
    }
    if (!res.ok) {
      state.answered = false;
      showError();
      return;
    }

    let result;
    try {
      result = await res.json();
    } catch (err) {
      state.answered = false;
      showError();
      return;
    }
    if (token !== state.token || question !== state.current) return;

    if (result.correct) state.correctCount += 1;
    el.calcInput.disabled = true;
    el.btnCheck.classList.add('hidden');
    el.btnHint.classList.add('hidden');
    el.calcHint.classList.add('hidden');
    renderFeedback(result, numEs(result.value));
  }

  function backToSessions() {
    state.token += 1; // invalida cualquier respuesta de red pendiente
    closeLightbox();
    showScreen('sessions');
  }

  // ---------- Eventos ----------
  el.btnBack.addEventListener('click', backToSessions);
  el.btnCompleteBack.addEventListener('click', backToSessions);
  el.btnNext.addEventListener('click', goToNextQuestion);
  el.btnRepeat.addEventListener('click', () => startSession(state.session.id));
  el.btnNextSession.addEventListener('click', () => {
    const id = el.btnNextSession.dataset.sessionId;
    if (id) startSession(id);
  });
  el.btnRetry.addEventListener('click', init);
  el.btnCheck.addEventListener('click', checkCalc);
  el.calcInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkCalc();
    }
  });
  el.calcInput.addEventListener('input', hideCalcError);
  el.btnHint.addEventListener('click', () => {
    const showing = !el.calcHint.classList.contains('hidden');
    el.calcHint.classList.toggle('hidden', showing);
    el.btnHint.textContent = showing ? 'Ver pista' : 'Ocultar pista';
  });
  el.figureBtn.addEventListener('click', openLightbox);
  el.lightbox.addEventListener('click', closeLightbox);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeLightbox();
  });

  // ---------- Arranque ----------
  function init() {
    loadConfig();
    loadSessions();
  }

  init();
})();
