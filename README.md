# CCDV-F Prep · Claude Certified Developer – Foundations

Web de estudio **bilingüe (inglés / español)** para preparar la certificación
**Claude Certified Developer – Foundations (CCDV-F)** de Anthropic.

> Material no oficial. **No contiene preguntas reales del examen**: todas las preguntas son originales,
> redactadas a partir de la documentación pública de Claude. Contrasta siempre con la
> [documentación oficial](https://platform.claude.com/docs) y con la *Exam Guide* del Anthropic Partner Academy.

## Qué incluye

| Sección | Contenido |
|---|---|
| **Temario** | Las 8 áreas del examen con su peso, explicaciones en inglés con traducción al español bajo demanda, ejemplos de código y "datos clave" para memorizar. |
| **Glosario** | 50+ términos técnicos y 25+ frases típicas de examen en inglés ("Which approach is MOST cost-effective?", "Select TWO"…). |
| **Práctica** | Preguntas por área con corrección inmediata y explicación bilingüe. Filtros: solo nuevas, solo falladas. |
| **Simulacro** | 53 preguntas en 120 minutos, repartidas según el peso de cada área, solo en inglés, con marcado (*flag*), navegación, nota en escala 100–1.000 (aprobado: 720) y revisión de fallos. Se guarda si cierras la pestaña. |
| **Repaso** | Lista de preguntas falladas y tus áreas más débiles. |

Tres modos de idioma (arriba a la derecha):

- **EN**: solo inglés, como en el examen real.
- **EN + ayuda** (recomendado): inglés con un botón **ES** junto a cada texto para ver la traducción.
- **ES**: todo en español (útil la primera vez que estudias un tema).

El progreso se guarda en el `localStorage` de tu navegador (no hay servidor ni cuentas).

## Áreas del examen

| Área | Peso |
|---|---|
| Applications and Integration | 33,1 % |
| Model Selection and Optimisation | 16,8 % |
| Agents and Workflows | 14,7 % |
| Prompt and Context Engineering | 11,0 % |
| Tools and MCPs | 10,6 % |
| Security and Safety | 8,1 % |
| Claude Code | 3,1 % |
| Eval, Testing, and Debugging | 2,6 % |

Pesos según la guía del examen v1.0 publicada por terceros; la Exam Guide oficial es la referencia definitiva.

## Usarla en local

No necesita instalación ni compilación. Puedes:

- Abrir `index.html` directamente en el navegador, o
- Servirla en local: `python3 -m http.server 8000` y abrir <http://localhost:8000>.

## Publicarla en GitHub Pages

```bash
cd claude-developer-prep
git init
git add .
git commit -m "Web de estudio CCDV-F"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/claude-developer-prep.git
git push -u origin main
```

Después, en GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch →
Branch: `main` / `(root)` → Save**. En un par de minutos estará en
`https://TU_USUARIO.github.io/claude-developer-prep/`.

El fichero `.nojekyll` ya está incluido para que GitHub Pages sirva los ficheros tal cual.

## Estructura

```
index.html              Página única (SPA con rutas #/...)
css/styles.css          Estilos (modo claro/oscuro automático)
js/app.js               Lógica: temario, práctica, simulacro, progreso
data/domains.js         Temario por área (EN/ES)
data/glossary.js        Glosario y frases de examen
data/questions/*.js     Banco de preguntas, un fichero por área
tools/validate.js       Validador del banco de preguntas
```

## Añadir preguntas

Cada fichero de `data/questions/` añade preguntas con este formato compacto:

```js
{
  id: "apps-31", d: "apps", t: "s", lvl: 2,          // t: "s" = una respuesta, "m" = varias
  q: ["Question in English?", "¿Pregunta en español?"],
  o: [["Option A", "Opción A"],
      ["Option B", "Opción B"],
      ["Option C", "Opción C"],
      ["Option D", "Opción D"]],
  a: [1],                                             // índices correctos (desde 0)
  x: ["Why B is correct…", "Por qué B es correcta…"],
  ref: "https://platform.claude.com/docs/..."         // opcional
}
```

- `d` debe ser uno de: `apps`, `model`, `agents`, `prompt`, `tools`, `security`, `claudecode`, `evals`.
- En las de respuesta múltiple (`t: "m"`) escribe "Select TWO" en el enunciado.
- Las opciones se barajan al mostrarse, así que la posición no importa. **Evita que la correcta sea siempre la más larga**:
  da a los distractores una justificación plausible.
- Si creas un fichero nuevo en `data/questions/`, añádelo también en `index.html`.

Antes de subir cambios, valida el banco:

```bash
node tools/validate.js
```

## Plan de estudio sugerido (4–6 semanas)

1. **Semanas 1–2:** temario completo en modo *EN + ayuda*, un área al día, empezando por las de más peso. Glosario cada día 10 minutos.
2. **Semanas 3–4:** práctica por áreas (10–20 preguntas al día). Repasa los fallos y vuelve al temario de esas áreas.
3. **Semanas 5–6:** simulacros completos en modo solo inglés, sin ayuda en español. Objetivo: 800+ de forma constante.
4. Complementa con los cursos de preparación del Anthropic Partner Academy y la documentación oficial (API, Agent SDK, Claude Code).

## Información del examen (noviembre de 2026)

- Preguntas de opción múltiple y de escenarios con varias respuestas; 120 minutos.
- Puntuación escalada 100–1.000; aprobado con 720.
- Solo en inglés, supervisado por Pearson VUE; no se permiten traductores del navegador.
- Solo disponible para personas de organizaciones del Claude Partner Network.
- Reintentos: espera de 14 días tras el 1.er suspenso, 30 tras el 2.º y 90 tras el 3.º; máximo 4 intentos en 12 meses.

Fuente: [FAQ de certificaciones del Anthropic Partner Academy](https://anthropic-partners.skilljar.com/page/faq-certifications).
Los datos técnicos del temario se contrastaron con la documentación de `platform.claude.com` y `code.claude.com` en noviembre de 2026;
la plataforma cambia a menudo, así que revisa la documentación si algo no te cuadra.
