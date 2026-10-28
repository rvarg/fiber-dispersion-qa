# Dispersión en Fibra

App de práctica sobre las **causas de la dispersión en fibra óptica** y
**cálculos básicos** (ensanchamiento de pulsos, tasa de datos y longitud
máxima del enlace), organizada en temas con preguntas de **opción
múltiple** y **problemas numéricos** (el estudiante escribe el resultado y
recibe la solución paso a paso). Cliente para celular (APK) y servidor
desplegable en una intranet **o** en Vercel (plan Hobby).

Es una **plantilla editable**: el contenido vive en archivos JSON, uno por
tema, que puedes modificar sin tocar el código — ver
[`server/data/README.md`](server/data/README.md).

> **Importante sobre el contenido incluido.** Las 43 preguntas de ejemplo
> están redactadas a partir de la teoría estándar de dispersión en fibras
> (intermodal, cromática, PMD y su efecto en la tasa de datos). **No se
> redactaron viendo el texto de Keiser** (cap. 3, sec. 3.2): el enlace de
> Google Drive compartido solo mostraba el visor del PDF, sin texto
> legible, y además correspondía a la **4.ª edición**, mientras que el
> ISBN indicado (978-981-33-4665-9) es una edición posterior, por lo que
> la numeración de secciones puede no coincidir.
>
> Antes de usarlas en clase conviene contrastar con el libro: notación,
> valores típicos y, sobre todo, **los criterios de tasa de datos**. Los
> problemas de este proyecto usan el criterio **B_max = 1/(2·Δτ)**, que
> aparece escrito en cada enunciado para que no dependa del libro; si tu
> texto usa otro (por ejemplo, uno basado en el ancho rms σ), cambia el
> enunciado y la respuesta. Cada pregunta admite un campo opcional
> `reference` (p. ej. «Keiser, sec. 3.2, p. 120») que se muestra al
> estudiante como «Para repasar»; complétalo tras verificar la página.

```
fiber-dispersion-qa/
├── public/         HTML/CSS/JS del cliente — fuente única, sirve tanto
│   │               para Vercel (sitio estático) como para el APK
│   └── img/        Esquemas de las preguntas (ensanchamiento, rayos, D vs λ)
├── client/         Configuración de Capacitor que empaqueta public/ en un APK
├── server/
│   ├── app.js      La app Express (rutas de la API) — sin escuchar puerto
│   ├── server.js   Arranque para intranet: usa app.js y escucha en 0.0.0.0
│   ├── validate.js Revisa los archivos de temas (npm run validate)
│   ├── lib/        Carga y validación del contenido
│   └── data/
│       ├── app.json            Textos del encabezado de la app
│       └── sessions/           sesion-01.json ... sesion-10.json (+ plantilla)
├── api/index.js    Punto de entrada para Vercel: exporta la misma app.js
├── vercel.json     Sirve public/ en la raíz; lo demás pasa a la función Express
├── package.json    Dependencias y scripts (npm run validate)
└── .devcontainer/  Entorno Theia/Docker con JDK + Android SDK preinstalados
```

`server/app.js` es la única definición de la API: `server/server.js`
(intranet) y `api/index.js` (Vercel) la reutilizan tal cual.

## Cómo funciona

1. El estudiante elige un tema, responde sus preguntas (cada una aparece
   una sola vez, en orden aleatorio por defecto) y recibe corrección y
   explicación inmediatas. Al terminar ve su resultado y puede repetir el
   tema o pasar al siguiente.
2. **Opción múltiple**: toca la opción; se marca la correcta y se explica.
3. **Cálculo**: escribe un número (acepta coma o punto decimal) y pulsa
   «Comprobar». Se acepta dentro de una tolerancia configurable (por
   defecto ±2 %), puede pedir una pista antes de responder y, después,
   ve la solución paso a paso. Si escribe algo que no es un número, la app
   se lo indica sin contarlo como intento.
4. Algunas preguntas llevan un esquema (se puede ampliar tocándolo).
5. El backend corrige en el servidor: las respuestas correctas no viajan
   al celular hasta que el estudiante responde.
