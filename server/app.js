/**
 * Dispersión en Fibra — Express app
 * --------------------------
 * Define la API REST y el servido estático del cliente web. No arranca
 * un servidor por sí solo (no llama a app.listen) — eso lo hace quien
 * importe este módulo:
 *
 *  - server/server.js   lo usa para correr en un servidor de intranet
 *                        (npm start), escuchando en 0.0.0.0:PORT.
 *  - api/index.js        lo exporta tal cual para desplegarlo como
 *                        función serverless en Vercel.
 *
 * Contenido editable (sin tocar código):
 *  - server/data/app.json                    textos del encabezado
 *  - server/data/sessions/sesion-NN.json     una sesión por archivo
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { loadSessions } = require('./lib/sessions');

const APP_CONFIG_PATH = path.join(__dirname, 'data', 'app.json');

const DEFAULT_APP_CONFIG = {
  eyebrow: 'Telecomunicaciones: fibra óptica',
  title: 'Dispersión en Fibra',
  subtitle: 'Causas de la dispersión y cálculos de ensanchamiento y tasa de datos: preguntas y problemas numéricos.',
  sessionsLabel: 'Elige un tema'
};

const app = express();
app.use(cors());
app.use(express.json());

// Sirve el cliente web (carpeta public/ en la raíz del proyecto) desde
// este mismo servidor. En Vercel esta ruta normalmente ni se ejecuta
// porque vercel.json sirve public/ directamente como sitio estático.
const PUBLIC_PATH = path.join(__dirname, '..', 'public');
if (fs.existsSync(PUBLIC_PATH)) {
  app.use(express.static(PUBLIC_PATH));
} else {
  app.get('/', (req, res) => {
    res.type('text/plain').send(
      'Dispersión en Fibra: servidor activo. No se encontró la carpeta public/ ' +
      'en la raíz del proyecto (se esperaba en ' + PUBLIC_PATH + '). ' +
      'La API sigue disponible en /api/*.'
    );
  });
}

// ---------- Carga de contenido ----------

function loadAppConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf-8'));
    const cfg = { ...DEFAULT_APP_CONFIG };
    for (const key of Object.keys(DEFAULT_APP_CONFIG)) {
      if (typeof raw[key] === 'string' && raw[key].trim()) cfg[key] = raw[key].trim();
    }
    return cfg;
  } catch (err) {
    console.warn(`app.json: no se pudo leer (${err.message}); se usan los textos por defecto.`);
    return { ...DEFAULT_APP_CONFIG };
  }
}

function loadContent() {
  const { sessions, warnings } = loadSessions();
  warnings.forEach(w => console.warn(`[sesiones] ${w}`));
  return { config: loadAppConfig(), sessions, warnings };
}

let content = loadContent();

// Quita del payload lo que revelaría la respuesta correcta
function publicQuestion(q) {
  const out = { id: q.id, type: q.type, prompt: q.prompt };
  if (q.type === 'mcq') out.options = q.options;
  if (q.type === 'calc') {
    out.unit = q.unit;
    if (q.hint) out.hint = q.hint;
  }
  if (q.image) out.image = q.image;
  return out;
}

// Interpreta lo que escribe el estudiante: acepta coma o punto decimal,
// espacios y el signo menos tipográfico (−). Devuelve NaN si no es un número.
function parseNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  if (typeof input !== 'string') return NaN;
  let s = input.trim().replace(/\u2212/g, '-').replace(/\s+/g, '');
  if (/^[+-]?\d+,\d+$/.test(s)) s = s.replace(',', '.');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

function formatNumber(value, decimals) {
  return value.toFixed(decimals);
}

function findSession(id) {
  return content.sessions.find(s => s.id === id);
}

// ---------- Rutas ----------

// Página de diagnóstico: abre https://TU-DOMINIO/api para comprobar que la
// función está desplegada y ver cuántas sesiones cargó.
app.get('/api', (req, res) => {
  res.json({
    app: content.config.title,
    status: 'ok',
    sessionCount: content.sessions.length,
    warnings: content.warnings.length,
    endpoints: ['/api/health', '/api/config', '/api/sessions', '/api/sessions/:sessionId']
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    sessionCount: content.sessions.length,
    warnings: content.warnings.length
  });
});

// Textos editables del encabezado (server/data/app.json)
app.get('/api/config', (req, res) => {
  res.json(content.config);
});

// Lista de sesiones (sin preguntas)
app.get('/api/sessions', (req, res) => {
  res.json(content.sessions.map(s => ({
    id: s.id,
    number: s.number,
    title: s.title,
    description: s.description,
    questionCount: s.questions.length
  })));
});

// Una sesión con todas sus preguntas (sin respuestas correctas)
app.get('/api/sessions/:sessionId', (req, res) => {
  const s = findSession(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
  res.json({
    id: s.id,
    number: s.number,
    title: s.title,
    description: s.description,
    shuffleQuestions: s.shuffleQuestions,
    questions: s.questions.map(publicQuestion)
  });
});

// Verifica una respuesta.
//   mcq:  body { optionId }
//   calc: body { value }  (texto o número)
app.post('/api/sessions/:sessionId/questions/:questionId/check', (req, res) => {
  const s = findSession(req.params.sessionId);
  if (!s) return res.status(404).json({ error: 'Sesión no encontrada' });
  const q = s.questions.find(q => q.id === req.params.questionId);
  if (!q) return res.status(404).json({ error: 'Pregunta no encontrada' });

  const body = req.body || {};

  if (q.type === 'calc') {
    const value = parseNumber(body.value);
    if (Number.isNaN(value)) {
      return res.status(400).json({ error: 'invalid_number' });
    }
    const allowed = Math.max(Math.abs(q.answer) * q.tolerancePercent / 100, q.toleranceAbs);
    // Pequeño margen para errores de coma flotante en el límite exacto
    const correct = Math.abs(value - q.answer) <= allowed + 1e-12;
    return res.json({
      type: 'calc',
      correct,
      value,
      correctAnswer: q.answer,
      correctAnswerText: formatNumber(q.answer, q.decimals),
      unit: q.unit,
      solution: q.solution,
      explanation: q.explanation,
      reference: q.reference
    });
  }

  res.json({
    type: 'mcq',
    correct: body.optionId === q.correctOptionId,
    correctOptionId: q.correctOptionId,
    explanation: q.explanation,
    reference: q.reference
  });
});

// Recarga los archivos sin reiniciar el proceso. Solo tiene efecto real en
// un despliegue de intranet de larga duración; en Vercel, para cambiar el
// contenido hay que editar los archivos, hacer commit y volver a desplegar.
app.post('/api/admin/reload', (req, res) => {
  content = loadContent();
  res.json({
    status: 'reloaded',
    sessionCount: content.sessions.length,
    warnings: content.warnings
  });
});

module.exports = app;
