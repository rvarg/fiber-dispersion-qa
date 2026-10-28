# Cómo editar el contenido

Todo el contenido de la app está en esta carpeta, en archivos JSON que
puedes editar con cualquier editor de texto. No hace falta tocar código.

```
server/data/
├── app.json                      Textos del encabezado de la app
└── sessions/
    ├── sesion-01.json            Una sesión por archivo (hasta sesion-10.json)
    ├── ...
    └── _plantilla-sesion.json    Plantilla para copiar (la app NO la carga)
```

## Reglas del diseño

- **Máximo 10 temas (sesiones)**: los archivos se llaman `sesion-01.json` a
  `sesion-10.json`. Un archivo con otro número o con otro nombre se ignora.
- **Máximo 10 preguntas por tema**. Si pones más, solo se usan las
  primeras 10 válidas.
- **Dos tipos de pregunta**: opción múltiple (`"type": "mcq"`, el tipo por defecto; 2 a 6 opciones, una correcta) y cálculo numérico (`"type": "calc"`, ver abajo).
- Un error en un archivo (JSON mal escrito, una pregunta incompleta) no
  tumba la app: esa sesión o pregunta se omite y el resto funciona. Para
  ver qué se omitió y por qué, ejecuta `npm run validate` desde la raíz del
  proyecto (o desde `server/`).

## Crear o reemplazar una sesión

1. Copia `sessions/_plantilla-sesion.json` como `sessions/sesion-NN.json`
   (por ejemplo `sesion-03.json`; si ya existe, edítalo directamente).
2. Cambia `title`, `description` y las preguntas.
3. Ejecuta `npm run validate`.
4. Reinicia el servidor (intranet) o haz commit y push (Vercel).

## Formato de una sesión

```json
{
  "title": "Muestreo y cuantización",
  "description": "Del mundo analógico al digital.",
  "shuffleQuestions": true,
  "questions": [
    {
      "prompt": "¿Qué fenómeno ocurre al muestrear por debajo de Nyquist?",
      "options": [
        { "id": "a", "text": "Aliasing" },
        { "id": "b", "text": "Saturación" },
        { "id": "c", "text": "Ruido térmico nulo" }
      ],
      "correctOptionId": "a",
      "explanation": "Las frecuencias altas se pliegan sobre las bajas."
    }
  ]
}
```

| Campo | ¿Obligatorio? | Descripción |
|---|---|---|
| `title` | Sí | Título de la sesión (se muestra en la lista). |
| `description` | No | Texto corto bajo el título. |
| `shuffleQuestions` | No | `true` (por defecto) baraja el orden de las preguntas en cada intento; `false` las muestra en el orden del archivo. |
| `questions` | Sí | Lista de preguntas (máx. 10). |

### Campos de cada pregunta

| Campo | ¿Obligatorio? | Descripción |
|---|---|---|
| `prompt` | Sí | Enunciado. |
| `options` | Sí | De 2 a 6 opciones `{ "id": "a", "text": "..." }`. Los `id` deben ser distintos entre sí (se muestran en mayúscula como A, B, C…). |
| `correctOptionId` | Sí | El `id` de la opción correcta. |
| `explanation` | No | Se muestra después de responder. Recomendada. |
| `image` | No | Imagen de la pregunta (ver abajo). |
| `reference` | No | Dónde repasar el tema, p. ej. `"Keiser, sec. 3.1, p. 105"`. Se muestra al estudiante como «Para repasar». Verifica la página en tu libro antes de escribirla. |
| `id` | No | Identificador único dentro de la sesión. Si lo omites se genera uno (`sesion-03-q01`, …). |

Los textos son texto plano: puedes escribir `<`, `>` o `&` sin problema
(por ejemplo «fs < 2B»). No se interpreta HTML.

## Preguntas de cálculo (`"type": "calc"`)

El estudiante escribe un número, se compara con la respuesta dentro de una
tolerancia y se le muestra la solución paso a paso.

```json
{
  "type": "calc",
  "prompt": "Una fibra tiene D = 17 ps/(nm·km). Una fuente de Δλ = 0,1 nm transmite por 80 km. ¿Cuál es el ensanchamiento Δτ = D·L·Δλ?",
  "unit": "ps",
  "answer": 136,
  "decimals": 0,
  "tolerancePercent": 2,
  "hint": "Multiplica D × L × Δλ",
  "solution": [
    "Δτ = D·L·Δλ.",
    "Δτ = 17 ps/(nm·km) × 80 km × 0,1 nm.",
    "Δτ = 136 ps."
  ],
  "explanation": "Comentario final opcional."
}
```

| Campo | ¿Obligatorio? | Descripción |
|---|---|---|
| `type` | Sí | `"calc"`. |
| `prompt` | Sí | Enunciado con todos los datos. |
| `answer` | Sí | La respuesta correcta como **número** (sin comillas y con **punto** decimal: `0.35`, no `"0,35"`). |
| `unit` | No | Unidad que se muestra junto a la casilla (`ps`, `ns`, `ps/(nm·km)`, `Gb/s`, `km`…). |
| `tolerancePercent` | No | Error relativo aceptado, en %. Por defecto **2**. |
| `toleranceAbs` | No | Error absoluto aceptado (en la misma unidad). Se acepta la respuesta si cumple **cualquiera** de las dos tolerancias. Útil cuando la respuesta es cercana a 0 o es un nivel en dBm/dB. |
| `decimals` | No | Decimales con que se muestra la respuesta correcta (0 a 6; por defecto 2). |
| `hint` | No | Pista que el estudiante puede mostrar antes de responder. |
| `solution` | Recomendado | Lista de pasos de la solución (máx. 12). |
| `explanation`, `image`, `reference`, `id` | No | Igual que en opción múltiple. |

Notas:

- El estudiante puede escribir coma o punto decimal (`0,4` o `0.4`) y el
  signo menos normal o tipográfico (−). Si escribe algo que no es un
  número, la app se lo indica y **no** lo cuenta como intento.
- Escribe en el enunciado todos los datos y la unidad esperada; evita
  respuestas que dependan de redondeos intermedios (la tolerancia de 2 %
  absorbe diferencias pequeñas, pero no errores de concepto).
- Calcula `answer` con la mayor precisión posible y deja que `decimals`
  controle cómo se muestra.

## Imágenes

```json
"image": {
  "url": "img/mi-figura.png",
  "alt": "Descripción de la imagen para quien no pueda verla",
  "caption": "Pie de figura opcional, p. ej. la fuente."
}
```

- `url` es **obligatoria**. Puede ser:
  - **Una imagen local**: guarda el archivo en `public/img/` y usa la ruta
    `img/nombre-del-archivo.png`. Funciona sin internet y también dentro
    del APK (queda empaquetada con la app). **Es la opción recomendada**.
  - **Un enlace web** `https://...`: es cómodo, pero el dispositivo
    necesita internet, y la imagen puede cambiar o desaparecer si su
    dueño la mueve. Si no carga, la app muestra un aviso en su lugar.
- `alt` es muy recomendable (accesibilidad). Si falta, `npm run validate`
  te avisa.
- `caption` es opcional.
- El estudiante puede tocar la imagen para verla ampliada.
- Formatos que funcionan en el navegador y en Android: PNG, JPG, WebP, SVG.
  Procura imágenes de menos de ~500 KB.
- **Derechos de autor**: usa imágenes propias o con licencia que permita
  su uso, y menciona la fuente en `caption` cuando la licencia lo exija.
  Para imágenes de Wikimedia Commons, revisa la licencia en la página del
  archivo.

Ejemplo de enlace a una imagen de Wikimedia Commons (esta app de ejemplo solo usa imágenes locales):

```
https://commons.wikimedia.org/wiki/Special:FilePath/NOMBRE_DEL_ARCHIVO.svg?width=600
```

(`NOMBRE_DEL_ARCHIVO.svg` es el nombre exacto del archivo en Commons, y
`?width=600` pide una versión de ese ancho.)

## Textos del encabezado: `app.json`

```json
{
  "eyebrow": "Telecomunicaciones: fibra óptica",
  "title": "Dispersión en Fibra",
  "subtitle": "Causas de la dispersión y cálculos de ensanchamiento y tasa de datos: preguntas y problemas numéricos.",
  "sessionsLabel": "Elige un tema"
}
```

Cambia aquí el texto pequeño sobre el título (`eyebrow`), el título, el
subtítulo y la frase que encabeza la lista de sesiones. Cualquier campo que
omitas usa un valor por defecto.

## ¿Prefieres escribir las preguntas en Excel?

Puedes armar una hoja con una fila por pregunta (sesión, enunciado,
opciones A–D, letra correcta, explicación) y convertirla a estos archivos
JSON con un pequeño script. Si lo necesitas, pídelo y se prepara.
