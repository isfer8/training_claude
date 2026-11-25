/* Syllabus. Weights follow the publicly reported CCDV-F blueprint (exam guide v1.0).
 * The official Exam Guide in Anthropic Partner Academy is the authoritative source.
 * Technical facts verified against platform.claude.com / code.claude.com docs (Nov 2026).
 */
window.DOMAINS = [
  /* ===================================================================== */
  {
    id: 'apps',
    weight: 33.1,
    name: { en: 'Applications and Integration', es: 'Aplicaciones e integración' },
    summary: {
      en: '<p>The biggest domain: one in three questions. It tests whether you can integrate the Claude API into a real application: the Messages API, the SDKs, streaming, stop reasons, errors and retries, rate limits, batches, structured outputs and context limits.</p>',
      es: '<p>El área más grande: una de cada tres preguntas. Evalúa si sabes integrar la API de Claude en una aplicación real: la Messages API, los SDK, streaming, motivos de parada, errores y reintentos, límites de uso, batches, salidas estructuradas y límites de contexto.</p>'
    },
    lessons: [
      {
        title: { en: 'The Messages API', es: 'La Messages API' },
        body: {
          en: '<p>Every interaction goes through <code>POST /v1/messages</code> with the headers <code>x-api-key</code>, <code>anthropic-version</code> and <code>content-type</code>. The request is <strong>stateless</strong>: you send the whole conversation every time.</p><ul><li><code>model</code>, <code>max_tokens</code> and <code>messages</code> are required.</li><li><code>system</code> is a top-level parameter, not a message role.</li><li>Messages use the roles <code>user</code> and <code>assistant</code>.</li><li>The response has a list of <strong>content blocks</strong> (<code>text</code>, <code>tool_use</code>, <code>thinking</code>…), a <code>stop_reason</code> and a <code>usage</code> object.</li></ul>',
          es: '<p>Toda interacción pasa por <code>POST /v1/messages</code> con las cabeceras <code>x-api-key</code>, <code>anthropic-version</code> y <code>content-type</code>. La petición es <strong>sin estado</strong>: envías la conversación completa cada vez.</p><ul><li><code>model</code>, <code>max_tokens</code> y <code>messages</code> son obligatorios.</li><li><code>system</code> es un parámetro de primer nivel, no un rol de mensaje.</li><li>Los mensajes usan los roles <code>user</code> y <code>assistant</code>.</li><li>La respuesta trae una lista de <strong>bloques de contenido</strong> (<code>text</code>, <code>tool_use</code>, <code>thinking</code>…), un <code>stop_reason</code> y un objeto <code>usage</code>.</li></ul>'
        },
        code: `import anthropic

client = anthropic.Anthropic()  # reads ANTHROPIC_API_KEY

message = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=1024,
    system="You are a concise support assistant.",
    messages=[{"role": "user", "content": "Summarise this ticket: ..."}],
)
text = next(b.text for b in message.content if b.type == "text")
print(message.stop_reason, message.usage)`
      },
      {
        title: { en: 'SDKs, retries and request IDs', es: 'SDK, reintentos e IDs de petición' },
        body: {
          en: '<p>Official client SDKs (Python, TypeScript and others) give you typed requests, typed exceptions and automatic retries.</p><ul><li>The SDK automatically retries connection errors, 429 and 5xx errors <strong>twice by default</strong> with exponential backoff, honouring <code>retry-after</code>. Change it with <code>max_retries</code>.</li><li>Catch typed exceptions (e.g. <code>anthropic.RateLimitError</code>, <code>anthropic.NotFoundError</code>) instead of matching message strings.</li><li>Every response has a <code>request-id</code> header (<code>_request_id</code> in the SDK). Log it and include it when you contact support.</li><li>The SDK refuses non-streaming requests that could exceed ~10 minutes: use streaming for large <code>max_tokens</code>.</li></ul>',
          es: '<p>Los SDK oficiales (Python, TypeScript y otros) te dan peticiones tipadas, excepciones tipadas y reintentos automáticos.</p><ul><li>El SDK reintenta automáticamente errores de conexión, 429 y 5xx <strong>dos veces por defecto</strong> con espera exponencial, respetando <code>retry-after</code>. Se cambia con <code>max_retries</code>.</li><li>Captura excepciones tipadas (p. ej. <code>anthropic.RateLimitError</code>, <code>anthropic.NotFoundError</code>) en vez de comparar textos de error.</li><li>Cada respuesta tiene una cabecera <code>request-id</code> (<code>_request_id</code> en el SDK). Regístrala e inclúyela al contactar con soporte.</li><li>El SDK rechaza peticiones sin streaming que puedan superar unos 10 minutos: usa streaming con <code>max_tokens</code> grandes.</li></ul>'
        },
        code: `client = anthropic.Anthropic(max_retries=5, timeout=120.0)

try:
    msg = client.messages.create(...)
    log.info("request_id=%s", msg._request_id)
except anthropic.RateLimitError as e:
    ...  # 429: back off, respect retry-after
except anthropic.APIStatusError as e:
    log.error("status=%s request_id=%s", e.status_code, e.request_id)`
      },
      {
        title: { en: 'Streaming (SSE)', es: 'Streaming (SSE)' },
        body: {
          en: '<p>With <code>stream: true</code> the API sends Server-Sent Events in this order:</p><ol><li><code>message_start</code> (empty content, initial usage, <code>stop_reason: null</code>)</li><li>For each block: <code>content_block_start</code> → <code>content_block_delta</code>… → <code>content_block_stop</code></li><li><code>message_delta</code> — here you get the <strong>final <code>stop_reason</code></strong> and cumulative <code>usage</code></li><li><code>message_stop</code></li></ol><p>Delta types: <code>text_delta</code>, <code>input_json_delta</code> (tool input as <em>partial JSON strings</em> — accumulate and parse at <code>content_block_stop</code>), <code>thinking_delta</code>, <code>signature_delta</code>. <code>ping</code> events can appear anywhere, and ignore unknown event types. An <code>error</code> event (e.g. <code>overloaded_error</code>) can arrive <strong>after an HTTP 200</strong>, so normal HTTP retry logic does not catch it.</p>',
          es: '<p>Con <code>stream: true</code> la API envía Server-Sent Events en este orden:</p><ol><li><code>message_start</code> (contenido vacío, uso inicial, <code>stop_reason: null</code>)</li><li>Por cada bloque: <code>content_block_start</code> → <code>content_block_delta</code>… → <code>content_block_stop</code></li><li><code>message_delta</code> — aquí llega el <strong><code>stop_reason</code> final</strong> y el <code>usage</code> acumulado</li><li><code>message_stop</code></li></ol><p>Tipos de delta: <code>text_delta</code>, <code>input_json_delta</code> (la entrada de la herramienta como <em>trozos de JSON</em> — acumúlalos y parsea en <code>content_block_stop</code>), <code>thinking_delta</code>, <code>signature_delta</code>. Pueden llegar eventos <code>ping</code> en cualquier momento, e ignora los tipos de evento desconocidos. Un evento <code>error</code> (p. ej. <code>overloaded_error</code>) puede llegar <strong>después de un HTTP 200</strong>, así que la lógica normal de reintentos HTTP no lo captura.</p>'
        },
        code: `with client.messages.stream(model="claude-sonnet-5-5", max_tokens=64000,
                            messages=msgs) as stream:
    for text in stream.text_stream:
        send_to_ui(text)
    final = stream.get_final_message()   # full Message, with stop_reason and usage`
      },
      {
        title: { en: 'Stop reasons', es: 'Motivos de parada (stop_reason)' },
        body: {
          en: '<p>A successful response always explains why generation stopped. Check it explicitly:</p><ul><li><code>end_turn</code> — finished naturally.</li><li><code>max_tokens</code> — truncated by your limit. Raise <code>max_tokens</code> or continue. An incomplete <code>tool_use</code> block means retry with a higher limit.</li><li><code>stop_sequence</code> — one of your <code>stop_sequences</code> fired (see the <code>stop_sequence</code> field).</li><li><code>tool_use</code> — run the client tool and send back a <code>tool_result</code>.</li><li><code>pause_turn</code> — a server-tool loop hit its iteration limit. Send the content back unchanged as an assistant message to continue.</li><li><code>refusal</code> — Claude declined (HTTP 200, billed). Rephrase or use a fallback.</li><li><code>model_context_window_exceeded</code> — output filled the context window; treat it as truncated.</li></ul>',
          es: '<p>Una respuesta correcta siempre explica por qué terminó la generación. Compruébalo de forma explícita:</p><ul><li><code>end_turn</code> — terminó de forma natural.</li><li><code>max_tokens</code> — cortada por tu límite. Sube <code>max_tokens</code> o continúa. Si el último bloque es un <code>tool_use</code> incompleto, reintenta con un límite mayor.</li><li><code>stop_sequence</code> — saltó una de tus <code>stop_sequences</code> (mira el campo <code>stop_sequence</code>).</li><li><code>tool_use</code> — ejecuta la herramienta de cliente y devuelve un <code>tool_result</code>.</li><li><code>pause_turn</code> — un bucle de herramientas de servidor llegó a su límite de iteraciones. Reenvía el contenido sin cambios como mensaje de assistant para continuar.</li><li><code>refusal</code> — Claude se negó (HTTP 200, se factura). Reformula o usa una alternativa.</li><li><code>model_context_window_exceeded</code> — la salida llenó la ventana de contexto; trátala como truncada.</li></ul>'
        }
      },
      {
        title: { en: 'Errors and retry strategy', es: 'Errores y estrategia de reintentos' },
        body: {
          en: '<table><tr><th>HTTP</th><th>type</th><th>Action</th></tr><tr><td>400</td><td>invalid_request_error</td><td>Fix the request (also returned for a spend limit <em>you</em> set). Don\'t retry as is.</td></tr><tr><td>401 / 403</td><td>authentication / permission</td><td>Fix key or permissions.</td></tr><tr><td>404</td><td>not_found_error</td><td>Check model ID / path.</td></tr><tr><td>413</td><td>request_too_large</td><td>Reduce payload (Messages 128 MB, Batch 256 MB).</td></tr><tr><td>429</td><td>rate_limit_error</td><td>Back off, respect <code>retry-after</code>. A spend-cap 429 has no <code>retry-after</code> and keeps failing.</td></tr><tr><td>500</td><td>api_error</td><td>Retry with exponential backoff.</td></tr><tr><td>504</td><td>timeout_error</td><td>Retry; use streaming for long requests.</td></tr><tr><td>529</td><td>overloaded_error</td><td>Retry with backoff (temporary overload).</td></tr></table><p>Good retry logic: exponential backoff <strong>with jitter</strong>, a maximum number of attempts, and only for retryable errors.</p>',
          es: '<table><tr><th>HTTP</th><th>tipo</th><th>Acción</th></tr><tr><td>400</td><td>invalid_request_error</td><td>Corrige la petición (también sale con un límite de gasto que pusiste <em>tú</em>). No reintentes tal cual.</td></tr><tr><td>401 / 403</td><td>authentication / permission</td><td>Corrige la clave o los permisos.</td></tr><tr><td>404</td><td>not_found_error</td><td>Revisa el ID del modelo o la ruta.</td></tr><tr><td>413</td><td>request_too_large</td><td>Reduce el tamaño (Messages 128 MB, Batch 256 MB).</td></tr><tr><td>429</td><td>rate_limit_error</td><td>Espera y respeta <code>retry-after</code>. Un 429 por tope de gasto no trae <code>retry-after</code> y seguirá fallando.</td></tr><tr><td>500</td><td>api_error</td><td>Reintenta con espera exponencial.</td></tr><tr><td>504</td><td>timeout_error</td><td>Reintenta; usa streaming en peticiones largas.</td></tr><tr><td>529</td><td>overloaded_error</td><td>Reintenta con espera (sobrecarga temporal).</td></tr></table><p>Una buena lógica de reintentos usa espera exponencial <strong>con jitter</strong> (aleatoriedad), un máximo de intentos y solo para errores reintentables.</p>'
        }
      },
      {
        title: { en: 'Rate limits and spend limits', es: 'Límites de uso y de gasto' },
        body: {
          en: '<ul><li>Rate limits are per model class: <strong>RPM</strong> (requests/min), <strong>ITPM</strong> (input tokens/min) and <strong>OTPM</strong> (output tokens/min). Exceeding any one returns 429.</li><li>The API uses a <strong>token bucket</strong>: capacity refills continuously, so bursts can trigger 429 even under the per-minute number.</li><li><strong>Cache reads do not count toward ITPM</strong>, so prompt caching raises your effective throughput.</li><li>OTPM counts tokens actually generated; <code>max_tokens</code> doesn\'t consume it.</li><li><strong>Ramp limits</strong> cap how fast usage can grow (<code>ramp_limit_exceeded</code>). Increase traffic gradually and spread bulk jobs. The Batch API is exempt.</li><li>Headers: <code>retry-after</code>, <code>anthropic-ratelimit-requests-*</code>, <code>anthropic-ratelimit-input-tokens-*</code>, <code>anthropic-ratelimit-output-tokens-*</code>.</li><li>Workspaces can have their own, lower, rate and spend limits.</li></ul>',
          es: '<ul><li>Los límites van por clase de modelo: <strong>RPM</strong> (peticiones/min), <strong>ITPM</strong> (tokens de entrada/min) y <strong>OTPM</strong> (tokens de salida/min). Superar cualquiera devuelve 429.</li><li>La API usa un <strong>token bucket</strong>: la capacidad se rellena de forma continua, así que una ráfaga puede dar 429 aunque estés por debajo del límite por minuto.</li><li><strong>Las lecturas de caché no cuentan para ITPM</strong>, así que el prompt caching aumenta tu capacidad real.</li><li>OTPM cuenta los tokens realmente generados; <code>max_tokens</code> no lo consume.</li><li>Los <strong>ramp limits</strong> limitan lo rápido que puede crecer el uso (<code>ramp_limit_exceeded</code>). Sube el tráfico poco a poco y reparte los trabajos masivos. La Batch API está exenta.</li><li>Cabeceras: <code>retry-after</code>, <code>anthropic-ratelimit-requests-*</code>, <code>anthropic-ratelimit-input-tokens-*</code>, <code>anthropic-ratelimit-output-tokens-*</code>.</li><li>Los workspaces pueden tener sus propios límites de uso y gasto, más bajos.</li></ul>'
        }
      },
      {
        title: { en: 'Message Batches API', es: 'Message Batches API' },
        body: {
          en: '<p>For work that doesn\'t need an immediate answer (nightly classification, bulk summaries, evals):</p><ul><li><strong>50% cheaper</strong> than standard prices; stacks with prompt caching.</li><li>Up to <strong>100,000 requests or 256 MB</strong> per batch.</li><li>Most batches finish within 1 hour; requests not processed in <strong>24 hours expire</strong> (not billed).</li><li>Results are a <code>.jsonl</code> file available for <strong>29 days</strong>, in <strong>no guaranteed order</strong>: match them by <code>custom_id</code>.</li><li>Result types: <code>succeeded</code>, <code>errored</code>, <code>canceled</code>, <code>expired</code>. Only <code>succeeded</code> is billed.</li><li>Not supported: <code>stream: true</code>. Supports tools, vision, thinking, system prompts and multi-turn.</li></ul>',
          es: '<p>Para trabajo que no necesita respuesta inmediata (clasificación nocturna, resúmenes masivos, evals):</p><ul><li><strong>50% más barato</strong> que el precio estándar; se combina con prompt caching.</li><li>Hasta <strong>100.000 peticiones o 256 MB</strong> por batch.</li><li>La mayoría termina en menos de 1 hora; las peticiones no procesadas en <strong>24 horas caducan</strong> (no se cobran).</li><li>Los resultados son un fichero <code>.jsonl</code> disponible <strong>29 días</strong>, <strong>sin orden garantizado</strong>: emparéjalos por <code>custom_id</code>.</li><li>Tipos de resultado: <code>succeeded</code>, <code>errored</code>, <code>canceled</code>, <code>expired</code>. Solo se factura <code>succeeded</code>.</li><li>No admite <code>stream: true</code>. Sí admite herramientas, visión, thinking, system prompt y multi-turno.</li></ul>'
        }
      },
      {
        title: { en: 'Structured outputs', es: 'Salidas estructuradas (structured outputs)' },
        body: {
          en: '<p>Two complementary features based on <strong>constrained decoding</strong>:</p><ul><li><strong>JSON outputs</strong>: <code>output_config.format = {type: "json_schema", schema: …}</code>. The final text is valid JSON that matches the schema. In Python, <code>client.messages.parse()</code> with a Pydantic model returns <code>parsed_output</code>.</li><li><strong>Strict tool use</strong>: <code>strict: true</code> on a tool guarantees the tool input matches its <code>input_schema</code>.</li><li>Objects need <code>additionalProperties: false</code>. Some constraints (e.g. <code>minimum</code>, <code>maxLength</code>) aren\'t supported; SDK helpers move them into descriptions.</li><li>Not guaranteed when <code>stop_reason</code> is <code>refusal</code> or <code>max_tokens</code>.</li><li>Incompatible with citations and with assistant prefill.</li><li>The first request with a new schema is slower (grammar compilation); compiled grammars are cached 24 h.</li></ul>',
          es: '<p>Dos funciones complementarias basadas en <strong>decodificación restringida</strong>:</p><ul><li><strong>Salidas JSON</strong>: <code>output_config.format = {type: "json_schema", schema: …}</code>. El texto final es JSON válido que cumple el esquema. En Python, <code>client.messages.parse()</code> con un modelo Pydantic devuelve <code>parsed_output</code>.</li><li><strong>Strict tool use</strong>: <code>strict: true</code> en una herramienta garantiza que la entrada cumple su <code>input_schema</code>.</li><li>Los objetos necesitan <code>additionalProperties: false</code>. Algunas restricciones (p. ej. <code>minimum</code>, <code>maxLength</code>) no se admiten; los helpers del SDK las pasan a la descripción.</li><li>No está garantizado si <code>stop_reason</code> es <code>refusal</code> o <code>max_tokens</code>.</li><li>Incompatible con citations y con el prefill del assistant.</li><li>La primera petición con un esquema nuevo es más lenta (compila la gramática); las gramáticas se cachean 24 h.</li></ul>'
        },
        code: `response = client.messages.create(
    model="claude-sonnet-5-5",
    max_tokens=1024,
    messages=[{"role": "user", "content": f"Extract the invoice data:\\n{doc}"}],
    output_config={"format": {"type": "json_schema", "schema": {
        "type": "object",
        "properties": {"vendor": {"type": "string"}, "total": {"type": "number"}},
        "required": ["vendor", "total"],
        "additionalProperties": False,
    }}},
)`
      },
      {
        title: { en: 'Context window, files and token counting', es: 'Ventana de contexto, ficheros y conteo de tokens' },
        body: {
          en: '<ul><li>Current models have a <strong>1M-token</strong> context window and up to <strong>128K output tokens</strong>.</li><li>Everything counts: system prompt, messages, tool definitions, tool results, images and the generated output (including thinking). Cached tokens still occupy the window — caching changes cost, not size.</li><li>If the <em>input</em> alone is too long → <strong>400</strong> "prompt is too long". If generation fills the window → <code>stop_reason: model_context_window_exceeded</code>.</li><li>Use the <strong>Token Counting API</strong> to estimate tokens before sending.</li><li>The <strong>Models API</strong> (<code>GET /v1/models</code>) returns IDs, lifecycle and capabilities — use it instead of hard-coding assumptions.</li><li>Images and PDFs can be sent as content blocks; the <strong>Files API</strong> lets you upload once and reference a file by ID.</li></ul>',
          es: '<ul><li>Los modelos actuales tienen una ventana de <strong>1M de tokens</strong> y hasta <strong>128K tokens de salida</strong>.</li><li>Todo cuenta: system prompt, mensajes, definiciones de herramientas, resultados de herramientas, imágenes y la salida generada (incluido el thinking). Los tokens en caché siguen ocupando la ventana: el caché cambia el coste, no el tamaño.</li><li>Si solo la <em>entrada</em> ya es demasiado larga → <strong>400</strong> "prompt is too long". Si la generación llena la ventana → <code>stop_reason: model_context_window_exceeded</code>.</li><li>Usa la <strong>Token Counting API</strong> para estimar tokens antes de enviar.</li><li>La <strong>Models API</strong> (<code>GET /v1/models</code>) devuelve IDs, ciclo de vida y capacidades: úsala en vez de suponer cosas en el código.</li><li>Puedes enviar imágenes y PDF como bloques de contenido; la <strong>Files API</strong> permite subir una vez y referenciar el fichero por ID.</li></ul>'
        }
      }
    ],
    keyFacts: [
      { en: 'SDK default: 2 automatic retries with exponential backoff (max_retries).', es: 'SDK por defecto: 2 reintentos automáticos con espera exponencial (max_retries).' },
      { en: 'Streaming: final stop_reason and usage arrive in message_delta.', es: 'Streaming: el stop_reason final y el usage llegan en message_delta.' },
      { en: '529 = overloaded (retry). 429 = rate limit (respect retry-after). 400 = fix the request.', es: '529 = sobrecarga (reintentar). 429 = límite de uso (respeta retry-after). 400 = corrige la petición.' },
      { en: 'Batches: 50% off, 100k requests / 256 MB, 24 h expiry, results 29 days, match by custom_id.', es: 'Batches: 50% de descuento, 100k peticiones / 256 MB, caducan a las 24 h, resultados 29 días, emparejar por custom_id.' },
      { en: 'Cache reads don\'t count toward ITPM.', es: 'Las lecturas de caché no cuentan para ITPM.' },
      { en: 'Structured outputs: output_config.format (json_schema) or strict: true on tools.', es: 'Salidas estructuradas: output_config.format (json_schema) o strict: true en herramientas.' }
    ],
    docs: [
      'https://platform.claude.com/docs/en/api/errors',
      'https://platform.claude.com/docs/en/build-with-claude/streaming',
      'https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons',
      'https://platform.claude.com/docs/en/api/rate-limits',
      'https://platform.claude.com/docs/en/build-with-claude/batch-processing',
      'https://platform.claude.com/docs/en/build-with-claude/structured-outputs'
    ]
  },

  /* ===================================================================== */
  {
    id: 'model',
    weight: 16.8,
    name: { en: 'Model Selection and Optimisation', es: 'Selección de modelo y optimización' },
    summary: {
      en: '<p>Choosing the right model and settings for quality, latency and cost: model tiers, effort, adaptive thinking, prompt caching, batching and other cost/latency levers.</p>',
      es: '<p>Elegir el modelo y los ajustes adecuados según calidad, latencia y coste: niveles de modelo, effort, adaptive thinking, prompt caching, batches y otras palancas de coste y latencia.</p>'
    },
    lessons: [
      {
        title: { en: 'Model tiers', es: 'Niveles de modelo' },
        body: {
          en: '<p>Think in tiers, not in exact names (names change; the reasoning doesn\'t):</p><ul><li><strong>Fable / Mythos tier</strong> — most capable and most expensive. Hardest reasoning and long-horizon agentic work.</li><li><strong>Opus</strong> — Anthropic\'s recommended default for most workloads: high intelligence at a lower price than Fable.</li><li><strong>Sonnet</strong> — strong balance of capability, speed and price; good for high-volume production and agentic coding.</li><li><strong>Haiku</strong> — fastest and cheapest: classification, routing, extraction, simple sub-agents, real-time UX.</li></ul><p>Typical exam logic: start with a capable model to reach the quality bar, then <strong>move down a tier where evals show quality holds</strong>. Route easy requests to a smaller model and hard ones to a bigger one.</p><p>Lifecycle: <code>active</code> → <code>deprecated</code> (still callable for existing users, closed to new adopters) → <code>retired</code> (requests fail). Plan migrations before retirement dates.</p>',
          es: '<p>Piensa en niveles, no en nombres exactos (los nombres cambian; el razonamiento no):</p><ul><li><strong>Nivel Fable / Mythos</strong> — el más capaz y el más caro. Razonamiento más difícil y trabajo agéntico de largo recorrido.</li><li><strong>Opus</strong> — el recomendado por Anthropic para la mayoría de cargas: mucha inteligencia a menor precio que Fable.</li><li><strong>Sonnet</strong> — buen equilibrio entre capacidad, velocidad y precio; ideal para producción de alto volumen y programación agéntica.</li><li><strong>Haiku</strong> — el más rápido y barato: clasificación, enrutado, extracción, subagentes sencillos, UX en tiempo real.</li></ul><p>Lógica típica del examen: empieza con un modelo capaz para alcanzar la calidad, y luego <strong>baja de nivel donde las evals demuestren que la calidad se mantiene</strong>. Envía las peticiones fáciles a un modelo pequeño y las difíciles a uno grande.</p><p>Ciclo de vida: <code>active</code> → <code>deprecated</code> (aún funciona para quien ya lo usaba, cerrado a nuevos usuarios) → <code>retired</code> (las peticiones fallan). Planifica la migración antes de la fecha de retirada.</p>'
        }
      },
      {
        title: { en: 'Adaptive thinking and effort', es: 'Adaptive thinking y effort' },
        body: {
          en: '<ul><li><strong>Adaptive thinking</strong> (<code>thinking: {type: "adaptive"}</code>) is the recommended mode: Claude decides per request whether and how much to think.</li><li>Depth is controlled with <strong><code>output_config.effort</code></strong>: <code>low</code>, <code>medium</code>, <code>high</code>, <code>xhigh</code>, <code>max</code> (availability depends on the model).</li><li>Effort affects <strong>all output</strong>: thinking, text and tool calls. Lower effort = fewer, terser tool calls and less preamble; higher effort = more thorough work and more tokens.</li><li>Use <code>low</code> for simple, high-volume or latency-sensitive tasks and sub-agents; <code>high</code>/<code>xhigh</code> for hard coding and long agentic tasks.</li><li>The legacy manual mode <code>{type: "enabled", budget_tokens: N}</code> is deprecated (minimum 1,024, must be below <code>max_tokens</code>), and newer models reject it.</li><li>Thinking tokens are billed as <strong>output tokens</strong> and count toward <code>max_tokens</code>.</li><li>Changing effort or thinking settings between requests can invalidate the prompt cache — keep them stable in a long session.</li></ul>',
          es: '<ul><li><strong>Adaptive thinking</strong> (<code>thinking: {type: "adaptive"}</code>) es el modo recomendado: Claude decide en cada petición si piensa y cuánto.</li><li>La profundidad se controla con <strong><code>output_config.effort</code></strong>: <code>low</code>, <code>medium</code>, <code>high</code>, <code>xhigh</code>, <code>max</code> (según el modelo).</li><li>El effort afecta a <strong>toda la salida</strong>: thinking, texto y llamadas a herramientas. Menos effort = menos llamadas, más escuetas y menos preámbulo; más effort = trabajo más exhaustivo y más tokens.</li><li>Usa <code>low</code> para tareas simples, de alto volumen o sensibles a la latencia y para subagentes; <code>high</code>/<code>xhigh</code> para programación difícil y tareas agénticas largas.</li><li>El modo manual antiguo <code>{type: "enabled", budget_tokens: N}</code> está obsoleto (mínimo 1.024, debe ser menor que <code>max_tokens</code>) y los modelos nuevos lo rechazan.</li><li>Los tokens de thinking se facturan como <strong>tokens de salida</strong> y cuentan para <code>max_tokens</code>.</li><li>Cambiar el effort o el thinking entre peticiones puede invalidar el caché: mantenlos estables en una sesión larga.</li></ul>'
        },
        code: `client.messages.create(
    model="claude-opus-5-5",
    max_tokens=64000,
    thinking={"type": "adaptive"},
    output_config={"effort": "high"},
    messages=[...],
)`
      },
      {
        title: { en: 'Prompt caching', es: 'Prompt caching' },
        body: {
          en: '<p>Reuse a long, <strong>identical prefix</strong> (system prompt, tool definitions, documents, earlier turns) across requests.</p><ul><li>Mark a breakpoint with <code>cache_control: {type: "ephemeral"}</code> on a content block, or use top-level automatic caching.</li><li>Prefix order: <strong><code>tools</code> → <code>system</code> → <code>messages</code></strong>. A change at one level invalidates that level and everything after it.</li><li>TTL: <strong>5 minutes</strong> by default (refreshed for free on each hit) or <strong>1 hour</strong> with <code>"ttl": "1h"</code>.</li><li>Pricing: 5-min write = 1.25× input price, 1-h write = 2×, cache read ≈ 0.1× (even lower on some newer models).</li><li>Up to <strong>4 breakpoints</strong> per request; each breakpoint looks back up to 20 blocks for an earlier write.</li><li>A prompt below the model\'s minimum length is simply <strong>not cached, with no error</strong>: check that <code>cache_creation_input_tokens</code> and <code>cache_read_input_tokens</code> aren\'t both 0.</li><li>Classic mistake: putting a timestamp or per-request data <em>before</em> the breakpoint → every request is a miss.</li><li>Usage fields: <code>cache_creation_input_tokens</code>, <code>cache_read_input_tokens</code>, and <code>input_tokens</code> = only the uncached tokens after the last breakpoint.</li></ul>',
          es: '<p>Reutiliza un <strong>prefijo idéntico</strong> y largo (system prompt, definiciones de herramientas, documentos, turnos anteriores) entre peticiones.</p><ul><li>Marca un punto de corte con <code>cache_control: {type: "ephemeral"}</code> en un bloque, o usa el caching automático de primer nivel.</li><li>Orden del prefijo: <strong><code>tools</code> → <code>system</code> → <code>messages</code></strong>. Un cambio en un nivel invalida ese nivel y todo lo que viene después.</li><li>TTL: <strong>5 minutos</strong> por defecto (se renueva gratis en cada acierto) o <strong>1 hora</strong> con <code>"ttl": "1h"</code>.</li><li>Precio: escritura 5 min = 1,25× el precio de entrada, escritura 1 h = 2×, lectura ≈ 0,1× (aún menos en algunos modelos nuevos).</li><li>Hasta <strong>4 breakpoints</strong> por petición; cada uno busca hacia atrás hasta 20 bloques una escritura anterior.</li><li>Un prompt por debajo del mínimo del modelo simplemente <strong>no se cachea, sin error</strong>: comprueba que <code>cache_creation_input_tokens</code> y <code>cache_read_input_tokens</code> no son ambos 0.</li><li>Error clásico: poner una marca de tiempo o datos de cada petición <em>antes</em> del breakpoint → todas las peticiones fallan el caché.</li><li>Campos de uso: <code>cache_creation_input_tokens</code>, <code>cache_read_input_tokens</code>, e <code>input_tokens</code> = solo los tokens sin caché tras el último breakpoint.</li></ul>'
        },
        code: `system=[
    {"type": "text", "text": LONG_STATIC_INSTRUCTIONS_AND_DOCS,
     "cache_control": {"type": "ephemeral"}},   # breakpoint on the LAST static block
],
messages=[{"role": "user", "content": f"[{now}] {user_question}"}]  # dynamic part AFTER`
      },
      {
        title: { en: 'Cost and latency levers', es: 'Palancas de coste y latencia' },
        body: {
          en: '<table><tr><th>Goal</th><th>Levers</th></tr><tr><td>Lower cost</td><td>Smaller model where quality holds · prompt caching for repeated prefixes · Batch API (50%) for non-urgent work · lower effort · shorter outputs (ask for concise format, sensible <code>max_tokens</code>) · trim context and tool results · fewer/smaller tool definitions</td></tr><tr><td>Lower latency</td><td><strong>Streaming</strong> (better perceived latency) · faster model · lower effort · prompt caching (faster time-to-first-token on long prefixes) · shorter outputs · parallel requests/tool calls</td></tr><tr><td>Higher quality</td><td>Better prompt and examples · more capable model · higher effort / thinking · better retrieval and context · evals to measure</td></tr></table><p>The Batch API <strong>cannot</strong> lower latency: it trades speed for price.</p>',
          es: '<table><tr><th>Objetivo</th><th>Palancas</th></tr><tr><td>Menos coste</td><td>Modelo más pequeño donde la calidad se mantenga · prompt caching para prefijos repetidos · Batch API (50%) para trabajo no urgente · menos effort · salidas más cortas (pide formato conciso, <code>max_tokens</code> razonable) · recortar contexto y resultados de herramientas · menos definiciones de herramientas o más pequeñas</td></tr><tr><td>Menos latencia</td><td><strong>Streaming</strong> (mejor latencia percibida) · modelo más rápido · menos effort · prompt caching (menor tiempo hasta el primer token con prefijos largos) · salidas más cortas · peticiones o llamadas a herramientas en paralelo</td></tr><tr><td>Más calidad</td><td>Mejor prompt y ejemplos · modelo más capaz · más effort / thinking · mejor recuperación y contexto · evals para medir</td></tr></table><p>La Batch API <strong>no</strong> reduce la latencia: cambia velocidad por precio.</p>'
        }
      }
    ],
    keyFacts: [
      { en: 'Cache prefix order: tools → system → messages.', es: 'Orden del prefijo de caché: tools → system → messages.' },
      { en: 'Cache TTL 5 min (default) or 1 h; write 1.25× / 2×, read ≈ 0.1×.', es: 'TTL del caché 5 min (por defecto) o 1 h; escritura 1,25× / 2×, lectura ≈ 0,1×.' },
      { en: 'Max 4 cache breakpoints; too-short prompts are silently not cached.', es: 'Máximo 4 breakpoints; los prompts demasiado cortos no se cachean y no da error.' },
      { en: 'Thinking tokens = output tokens; they count toward max_tokens.', es: 'Tokens de thinking = tokens de salida; cuentan para max_tokens.' },
      { en: 'Effort levels: low, medium, high, xhigh, max. Effort affects text, tools and thinking.', es: 'Niveles de effort: low, medium, high, xhigh, max. Afecta a texto, herramientas y thinking.' },
      { en: 'Batch = cheaper, not faster. Streaming = faster perceived, not cheaper.', es: 'Batch = más barato, no más rápido. Streaming = parece más rápido, no es más barato.' }
    ],
    docs: [
      'https://platform.claude.com/docs/en/models/overview',
      'https://platform.claude.com/docs/en/build-with-claude/prompt-caching',
      'https://platform.claude.com/docs/en/build-with-claude/effort',
      'https://platform.claude.com/docs/en/build-with-claude/extended-thinking'
    ]
  },

  /* ===================================================================== */
  {
    id: 'agents',
    weight: 14.7,
    name: { en: 'Agents and Workflows', es: 'Agentes y flujos de trabajo' },
    summary: {
      en: '<p>When to use a fixed workflow and when to use an autonomous agent, how the agent loop works, which Anthropic tool to build it with, and how to keep long-running agents reliable (context management, sub-agents, human-in-the-loop).</p>',
      es: '<p>Cuándo usar un flujo fijo y cuándo un agente autónomo, cómo funciona el bucle del agente, con qué herramienta de Anthropic construirlo y cómo mantener fiables los agentes de larga duración (gestión de contexto, subagentes, humano en el bucle).</p>'
    },
    lessons: [
      {
        title: { en: 'Workflows vs agents', es: 'Workflows frente a agentes' },
        body: {
          en: '<p><strong>Workflows</strong> follow predefined code paths; <strong>agents</strong> decide their own steps and tool calls in a loop. Start with the simplest thing that works: a single well-prompted call, then a workflow, and only then an agent. Agents trade cost and latency for flexibility.</p><ul><li><strong>Prompt chaining</strong> — fixed sequence of steps, with checks ("gates") between them. E.g. outline → check → write.</li><li><strong>Routing</strong> — classify the input, then send it to a specialised prompt or model (e.g. easy → Haiku, hard → Opus).</li><li><strong>Parallelization</strong> — <em>sectioning</em> (independent sub-tasks at once) or <em>voting</em> (same task several times for confidence).</li><li><strong>Orchestrator-workers</strong> — a central model breaks down a task it can\'t predict in advance and delegates to workers.</li><li><strong>Evaluator-optimizer</strong> — one call generates, another evaluates and gives feedback, in a loop.</li><li><strong>Autonomous agent</strong> — open-ended problems where you can\'t hard-code the steps; needs clear tools, stop conditions and guardrails.</li></ul>',
          es: '<p>Los <strong>workflows</strong> siguen caminos de código predefinidos; los <strong>agentes</strong> deciden sus propios pasos y llamadas a herramientas en un bucle. Empieza por lo más simple que funcione: una sola llamada bien diseñada, luego un workflow y solo después un agente. Los agentes cambian coste y latencia por flexibilidad.</p><ul><li><strong>Prompt chaining</strong> (encadenado) — secuencia fija de pasos, con comprobaciones ("gates") entre ellos. P. ej. esquema → comprobar → redactar.</li><li><strong>Routing</strong> (enrutado) — clasifica la entrada y envíala a un prompt o modelo especializado (p. ej. fácil → Haiku, difícil → Opus).</li><li><strong>Parallelization</strong> — <em>sectioning</em> (subtareas independientes a la vez) o <em>voting</em> (la misma tarea varias veces para tener más confianza).</li><li><strong>Orchestrator-workers</strong> — un modelo central divide una tarea que no se puede prever de antemano y delega en trabajadores.</li><li><strong>Evaluator-optimizer</strong> — una llamada genera, otra evalúa y da feedback, en bucle.</li><li><strong>Agente autónomo</strong> — problemas abiertos donde no puedes fijar los pasos en el código; necesita herramientas claras, condiciones de parada y salvaguardas.</li></ul>'
        }
      },
      {
        title: { en: 'The agent loop', es: 'El bucle del agente' },
        body: {
          en: '<ol><li>Send the request with <code>tools</code>.</li><li>If <code>stop_reason == "tool_use"</code>: run each requested tool, append the assistant content <strong>unchanged</strong>, then a user message with one <code>tool_result</code> per <code>tool_use</code>.</li><li>Repeat until <code>end_turn</code> (or another stop reason).</li></ol><p>Production essentials: a <strong>maximum number of iterations</strong>, a cap on tool retries, timeouts, logging of every step, and handling of <code>max_tokens</code>, <code>pause_turn</code> and <code>refusal</code>. If you don\'t need custom control, the SDK\'s <strong>tool runner</strong> manages the loop for you. With thinking enabled, pass thinking blocks back unmodified (with their signature) during the tool loop.</p>',
          es: '<ol><li>Envía la petición con <code>tools</code>.</li><li>Si <code>stop_reason == "tool_use"</code>: ejecuta cada herramienta pedida, añade el contenido del assistant <strong>sin modificar</strong> y después un mensaje de user con un <code>tool_result</code> por cada <code>tool_use</code>.</li><li>Repite hasta <code>end_turn</code> (u otro motivo de parada).</li></ol><p>Básicos de producción: un <strong>número máximo de iteraciones</strong>, un tope de reintentos por herramienta, timeouts, registro de cada paso, y gestión de <code>max_tokens</code>, <code>pause_turn</code> y <code>refusal</code>. Si no necesitas control a medida, el <strong>tool runner</strong> del SDK gestiona el bucle por ti. Con thinking activado, devuelve los bloques de thinking sin modificar (con su firma) durante el bucle de herramientas.</p>'
        },
        code: `for _ in range(MAX_STEPS):
    resp = client.messages.create(model=M, max_tokens=8000, tools=TOOLS, messages=msgs)
    msgs.append({"role": "assistant", "content": resp.content})
    if resp.stop_reason != "tool_use":
        break
    results = [run_tool(b) for b in resp.content if b.type == "tool_use"]
    msgs.append({"role": "user", "content": results})   # tool_result blocks first
else:
    raise RuntimeError("Agent exceeded MAX_STEPS")`
      },
      {
        title: { en: 'Which Anthropic tool to build with?', es: '¿Con qué herramienta de Anthropic construirlo?' },
        body: {
          en: '<table><tr><th>Option</th><th>Use it when</th></tr><tr><td><strong>Client SDK</strong> (Messages API)</td><td>You want full control and write the tool loop yourself (or use the beta tool runner).</td></tr><tr><td><strong>Claude Agent SDK</strong> (Python / TypeScript)</td><td>You want Claude Code\'s agent loop, built-in tools (read/edit files, run commands, web search), permissions, hooks, sub-agents, sessions and MCP inside <em>your own</em> process.</td></tr><tr><td><strong>Claude Code CLI</strong></td><td>Interactive development, or scripts/CI with <code>claude -p</code>.</td></tr><tr><td><strong>Managed Agents</strong></td><td>You want Anthropic to host the agent harness and sandbox.</td></tr></table><p>Agent SDK products must authenticate with an <strong>API key</strong>; third parties may not offer claude.ai login unless approved.</p>',
          es: '<table><tr><th>Opción</th><th>Úsala cuando</th></tr><tr><td><strong>Client SDK</strong> (Messages API)</td><td>Quieres control total y escribes tú el bucle de herramientas (o usas el tool runner en beta).</td></tr><tr><td><strong>Claude Agent SDK</strong> (Python / TypeScript)</td><td>Quieres el bucle de agente de Claude Code, sus herramientas integradas (leer/editar ficheros, ejecutar comandos, buscar en la web), permisos, hooks, subagentes, sesiones y MCP dentro de <em>tu propio</em> proceso.</td></tr><tr><td><strong>Claude Code CLI</strong></td><td>Desarrollo interactivo, o scripts/CI con <code>claude -p</code>.</td></tr><tr><td><strong>Managed Agents</strong></td><td>Quieres que Anthropic aloje el entorno del agente y el sandbox.</td></tr></table><p>Los productos hechos con el Agent SDK deben autenticarse con una <strong>API key</strong>; terceros no pueden ofrecer login de claude.ai salvo aprobación.</p>'
        }
      },
      {
        title: { en: 'Context management for long-running agents', es: 'Gestión de contexto en agentes de larga duración' },
        body: {
          en: '<ul><li><strong>Compaction</strong> (server-side, beta): summarises earlier parts of the conversation so the agent can keep going past the context limit. The primary strategy for long conversations.</li><li><strong>Context editing</strong>: targeted clean-up, e.g. <em>tool result clearing</em> (drop old, bulky tool outputs) or thinking-block clearing.</li><li><strong>Memory tool</strong>: lets the agent store and read notes in files across sessions.</li><li><strong>State files + git</strong>: keep progress in structured files (e.g. <code>tests.json</code>, <code>progress.txt</code>) and commit checkpoints so a fresh context can resume.</li><li><strong>Sub-agents</strong>: run verbose work (searches, logs, tests) in an isolated context and return only a summary to the main agent.</li><li>Return <strong>high-signal tool results</strong>: only the fields the next step needs, with stable IDs.</li></ul>',
          es: '<ul><li><strong>Compaction</strong> (en el servidor, beta): resume las partes antiguas de la conversación para que el agente siga más allá del límite de contexto. Es la estrategia principal para conversaciones largas.</li><li><strong>Context editing</strong>: limpieza selectiva, p. ej. <em>tool result clearing</em> (quitar resultados de herramientas antiguos y voluminosos) o limpiar bloques de thinking.</li><li><strong>Memory tool</strong>: permite al agente guardar y leer notas en ficheros entre sesiones.</li><li><strong>Ficheros de estado + git</strong>: guarda el progreso en ficheros estructurados (p. ej. <code>tests.json</code>, <code>progress.txt</code>) y haz commits de control para que un contexto nuevo pueda retomar.</li><li><strong>Subagentes</strong>: ejecutan el trabajo voluminoso (búsquedas, logs, tests) en un contexto aislado y solo devuelven un resumen al agente principal.</li><li>Devuelve <strong>resultados de herramientas con mucha señal</strong>: solo los campos que necesita el siguiente paso, con IDs estables.</li></ul>'
        }
      },
      {
        title: { en: 'Human-in-the-loop and guardrails', es: 'Humano en el bucle y salvaguardas' },
        body: {
          en: '<ul><li>Require <strong>human confirmation</strong> before risky, irreversible or shared-system actions (payments, deletions, sending emails, <code>git push --force</code>).</li><li>Give the agent the <strong>minimum tools and permissions</strong> it needs; prefer read-only tools when possible.</li><li>Set budgets: max steps, max tokens/cost, timeouts.</li><li>Make tools <strong>idempotent</strong> where you can, so a retry doesn\'t duplicate an action.</li><li>Log and trace each step (inputs, tool calls, results, request IDs) so you can debug and audit.</li></ul>',
          es: '<ul><li>Exige <strong>confirmación humana</strong> antes de acciones arriesgadas, irreversibles o sobre sistemas compartidos (pagos, borrados, envío de emails, <code>git push --force</code>).</li><li>Da al agente las <strong>mínimas herramientas y permisos</strong> que necesite; usa herramientas de solo lectura cuando sea posible.</li><li>Pon presupuestos: máximo de pasos, máximo de tokens/coste, timeouts.</li><li>Haz las herramientas <strong>idempotentes</strong> cuando puedas, para que un reintento no duplique una acción.</li><li>Registra y traza cada paso (entradas, llamadas, resultados, request IDs) para poder depurar y auditar.</li></ul>'
        }
      }
    ],
    keyFacts: [
      { en: 'Simplest first: single call → workflow → agent.', es: 'Lo más simple primero: una llamada → workflow → agente.' },
      { en: 'Routing = classify then dispatch. Orchestrator-workers = dynamic sub-tasks. Evaluator-optimizer = generate + critique loop.', es: 'Routing = clasificar y despachar. Orchestrator-workers = subtareas dinámicas. Evaluator-optimizer = bucle generar + criticar.' },
      { en: 'Agent loop: always cap iterations and tool retries.', es: 'Bucle del agente: limita siempre las iteraciones y los reintentos de herramientas.' },
      { en: 'Agent SDK = Claude Code\'s loop and tools as a library (Python/TS).', es: 'Agent SDK = el bucle y las herramientas de Claude Code como librería (Python/TS).' },
      { en: 'Sub-agents isolate context; only a summary returns.', es: 'Los subagentes aíslan el contexto; solo vuelve un resumen.' },
      { en: 'Compaction = summarise old context; context editing = clear old tool results.', es: 'Compaction = resumir contexto antiguo; context editing = quitar resultados de herramientas viejos.' }
    ],
    docs: [
      'https://www.anthropic.com/engineering/building-effective-agents',
      'https://code.claude.com/docs/en/agent-sdk/overview',
      'https://platform.claude.com/docs/en/build-with-claude/context-windows'
    ]
  },

  /* ===================================================================== */
  {
    id: 'prompt',
    weight: 11.0,
    name: { en: 'Prompt and Context Engineering', es: 'Ingeniería de prompts y de contexto' },
    summary: {
      en: '<p>Writing prompts that work in production and deciding what goes into the context window: clarity, structure with XML tags, examples, roles, long-context layout, thinking, output format and context engineering.</p>',
      es: '<p>Escribir prompts que funcionen en producción y decidir qué entra en la ventana de contexto: claridad, estructura con etiquetas XML, ejemplos, roles, organización de contextos largos, thinking, formato de salida e ingeniería de contexto.</p>'
    },
    lessons: [
      {
        title: { en: 'Clear, direct and motivated', es: 'Claro, directo y con motivo' },
        body: {
          en: '<ul><li><strong>Be explicit.</strong> Ask directly for what you want, including "extra" behaviour. Test: could a new colleague with no context follow it?</li><li><strong>Explain why.</strong> "The answer will be read by a text-to-speech engine, so don\'t use ellipses" generalises better than "NEVER use ellipses".</li><li><strong>Say what to do, not what to avoid.</strong> "Write in flowing prose paragraphs" beats "Don\'t use markdown".</li><li><strong>Avoid shouting.</strong> "CRITICAL: you MUST use this tool" can cause over-triggering on current models; "Use this tool when…" is better.</li><li><strong>Be explicit about action.</strong> "Can you suggest changes?" gets suggestions; "Change this function to…" gets edits.</li></ul>',
          es: '<ul><li><strong>Sé explícito.</strong> Pide directamente lo que quieres, incluido el comportamiento "extra". Prueba: ¿lo seguiría un compañero nuevo sin contexto?</li><li><strong>Explica el porqué.</strong> "La respuesta la leerá un sintetizador de voz, así que no uses puntos suspensivos" generaliza mejor que "NUNCA uses puntos suspensivos".</li><li><strong>Di qué hacer, no qué evitar.</strong> "Escribe en párrafos de prosa fluida" funciona mejor que "No uses markdown".</li><li><strong>No grites.</strong> "CRÍTICO: DEBES usar esta herramienta" puede provocar que se use de más en los modelos actuales; "Usa esta herramienta cuando…" es mejor.</li><li><strong>Sé explícito sobre la acción.</strong> "¿Puedes sugerir cambios?" da sugerencias; "Cambia esta función para…" da ediciones.</li></ul>'
        }
      },
      {
        title: { en: 'Structure: XML tags, examples and roles', es: 'Estructura: etiquetas XML, ejemplos y roles' },
        body: {
          en: '<ul><li><strong>XML tags</strong> separate parts of the prompt: <code>&lt;instructions&gt;</code>, <code>&lt;context&gt;</code>, <code>&lt;document&gt;</code>, <code>&lt;example&gt;</code>. Use consistent, descriptive names; nest them for hierarchy. They also make output easy to parse (e.g. <code>&lt;answer&gt;</code>).</li><li><strong>Examples (multishot)</strong>: 3–5 relevant, <strong>diverse</strong> examples wrapped in <code>&lt;example&gt;</code> tags. Diversity stops Claude from copying one pattern.</li><li><strong>Role</strong>: one sentence in the <code>system</code> prompt ("You are a senior tax advisor…") focuses tone and expertise. Put stable instructions in the system prompt and the per-request task in the user message.</li></ul>',
          es: '<ul><li>Las <strong>etiquetas XML</strong> separan las partes del prompt: <code>&lt;instructions&gt;</code>, <code>&lt;context&gt;</code>, <code>&lt;document&gt;</code>, <code>&lt;example&gt;</code>. Usa nombres coherentes y descriptivos; anídalas para indicar jerarquía. También facilitan parsear la salida (p. ej. <code>&lt;answer&gt;</code>).</li><li><strong>Ejemplos (multishot)</strong>: 3–5 ejemplos relevantes y <strong>variados</strong> dentro de etiquetas <code>&lt;example&gt;</code>. La variedad evita que Claude copie un único patrón.</li><li><strong>Rol</strong>: una frase en el <code>system</code> prompt ("Eres un asesor fiscal sénior…") centra el tono y la experiencia. Pon las instrucciones estables en el system prompt y la tarea de cada petición en el mensaje de user.</li></ul>'
        }
      },
      {
        title: { en: 'Long context (20K+ tokens)', es: 'Contexto largo (más de 20K tokens)' },
        body: {
          en: '<ul><li>Put <strong>long documents at the top</strong> and the question/instructions <strong>at the end</strong>. In Anthropic\'s tests this improves quality by up to 30%, especially with several documents.</li><li>Wrap each document in <code>&lt;document&gt;</code> with sub-tags such as <code>&lt;source&gt;</code> and <code>&lt;document_content&gt;</code>.</li><li><strong>Ground answers in quotes</strong>: ask Claude to extract the relevant quotes first and then answer. This reduces hallucinations.</li></ul>',
          es: '<ul><li>Pon los <strong>documentos largos arriba</strong> y la pregunta/instrucciones <strong>al final</strong>. En las pruebas de Anthropic mejora la calidad hasta un 30%, sobre todo con varios documentos.</li><li>Envuelve cada documento en <code>&lt;document&gt;</code> con subetiquetas como <code>&lt;source&gt;</code> y <code>&lt;document_content&gt;</code>.</li><li><strong>Basa las respuestas en citas</strong>: pide a Claude que extraiga primero las citas relevantes y luego responda. Reduce las alucinaciones.</li></ul>'
        }
      },
      {
        title: { en: 'Thinking, format control and prefill', es: 'Thinking, control de formato y prefill' },
        body: {
          en: '<ul><li>With <strong>adaptive thinking</strong>, prefer high-level instructions ("think carefully about edge cases") over a hand-written step-by-step plan.</li><li>With thinking off, ask for reasoning in tags and the result in <code>&lt;answer&gt;</code> so you can extract it.</li><li>Self-check: "Before you finish, verify your answer against the test cases."</li><li><strong>Assistant prefill</strong> (starting the assistant\'s final turn yourself) is <strong>not supported on recent models</strong> (returns 400). Use explicit format instructions, XML format indicators or <strong>structured outputs</strong> instead.</li><li>Match the style of your prompt to the style you want back: a markdown-heavy prompt tends to get markdown.</li></ul>',
          es: '<ul><li>Con <strong>adaptive thinking</strong>, mejor instrucciones generales ("piensa bien en los casos límite") que un plan paso a paso escrito a mano.</li><li>Sin thinking, pide el razonamiento entre etiquetas y el resultado en <code>&lt;answer&gt;</code> para poder extraerlo.</li><li>Autocomprobación: "Antes de terminar, verifica tu respuesta con los casos de prueba".</li><li>El <strong>prefill del assistant</strong> (empezar tú el último turno del assistant) <strong>no se admite en los modelos recientes</strong> (devuelve 400). Usa instrucciones de formato explícitas, indicadores de formato en XML o <strong>structured outputs</strong>.</li><li>El estilo de tu prompt influye en el de la respuesta: un prompt lleno de markdown tiende a recibir markdown.</li></ul>'
        }
      },
      {
        title: { en: 'Context engineering', es: 'Ingeniería de contexto' },
        body: {
          en: '<p>Context is a limited resource: more tokens mean more cost and latency, and irrelevant content can distract the model. Aim for the <strong>smallest set of high-signal tokens</strong> that lets Claude do the task.</p><ul><li>Retrieve <strong>just in time</strong> (search/read tools, RAG) instead of dumping everything up front.</li><li>Keep tool definitions focused; too many overlapping tools confuse selection (use tool search for very large sets).</li><li>Trim tool results to the fields that matter; paginate large results.</li><li>Put untrusted content (web pages, emails, uploads) inside <code>tool_result</code> or clearly delimited document tags — never in the system prompt.</li><li>Stable content first and dynamic content last also maximises prompt-cache hits.</li></ul>',
          es: '<p>El contexto es un recurso limitado: más tokens implican más coste y latencia, y el contenido irrelevante puede distraer al modelo. Busca el <strong>conjunto más pequeño de tokens con mucha señal</strong> que permita a Claude hacer la tarea.</p><ul><li>Recupera información <strong>justo cuando hace falta</strong> (herramientas de búsqueda/lectura, RAG) en lugar de volcarlo todo al principio.</li><li>Mantén las definiciones de herramientas enfocadas; muchas herramientas solapadas confunden la elección (usa tool search si son muchísimas).</li><li>Recorta los resultados de herramientas a los campos importantes; pagina los resultados grandes.</li><li>Pon el contenido no fiable (páginas web, emails, ficheros subidos) dentro de <code>tool_result</code> o de etiquetas de documento bien delimitadas, nunca en el system prompt.</li><li>Contenido estable primero y dinámico al final: además maximiza los aciertos del prompt caching.</li></ul>'
        }
      }
    ],
    keyFacts: [
      { en: 'Long docs at the top, question at the end (up to +30% quality).', es: 'Documentos largos arriba, pregunta al final (hasta +30% de calidad).' },
      { en: '3–5 diverse examples in <example> tags.', es: '3–5 ejemplos variados en etiquetas <example>.' },
      { en: 'Explain the reason behind instructions; say what to do, not what not to do.', es: 'Explica el motivo de las instrucciones; di qué hacer, no qué no hacer.' },
      { en: 'Prefill on the final assistant turn is not supported on recent models → use structured outputs / instructions.', es: 'El prefill del último turno del assistant no se admite en modelos recientes → usa structured outputs / instrucciones.' },
      { en: 'Ask for quotes first to reduce hallucinations.', es: 'Pide citas primero para reducir alucinaciones.' }
    ],
    docs: [
      'https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices',
      'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents'
    ]
  },

  /* ===================================================================== */
  {
    id: 'tools',
    weight: 10.6,
    name: { en: 'Tools and MCPs', es: 'Herramientas y MCP' },
    summary: {
      en: '<p>Designing tools Claude can use well, handling tool calls and results correctly, forcing or limiting tool use, server tools, and the Model Context Protocol (MCP), including the MCP connector in the Messages API.</p>',
      es: '<p>Diseñar herramientas que Claude use bien, gestionar llamadas y resultados correctamente, forzar o limitar el uso de herramientas, las herramientas de servidor y el Model Context Protocol (MCP), incluido el conector MCP de la Messages API.</p>'
    },
    lessons: [
      {
        title: { en: 'Defining good tools', es: 'Definir buenas herramientas' },
        body: {
          en: '<ul><li>A tool has a <code>name</code> (regex <code>^[a-zA-Z0-9_-]{1,128}$</code> — no dots or spaces), a <code>description</code> and an <code>input_schema</code> (JSON Schema).</li><li>The <strong>description is the most important factor</strong> in tool performance: what it does, when to use it (and when not), what each parameter means, limitations. Aim for 3–4+ sentences.</li><li>Use <code>input_examples</code> for complex or format-sensitive inputs.</li><li><strong>Namespace</strong> names across services: <code>github_list_prs</code>, <code>slack_send_message</code>.</li><li><strong>Consolidate</strong> related operations into one tool with an <code>action</code> parameter instead of many near-identical tools.</li><li>Return <strong>high-signal results</strong> with stable identifiers; don\'t ask for "step-by-step reasoning" parameters (can trigger a refusal) — ask for a short explanation instead.</li><li>Tool definitions cost input tokens on every request (plus a small automatic system prompt) — another reason to keep them focused.</li></ul>',
          es: '<ul><li>Una herramienta tiene <code>name</code> (regex <code>^[a-zA-Z0-9_-]{1,128}$</code>: sin puntos ni espacios), <code>description</code> e <code>input_schema</code> (JSON Schema).</li><li>La <strong>descripción es el factor más importante</strong> del rendimiento: qué hace, cuándo usarla (y cuándo no), qué significa cada parámetro, limitaciones. Apunta a 3–4 frases o más.</li><li>Usa <code>input_examples</code> para entradas complejas o con formato delicado.</li><li>Pon <strong>prefijos</strong> a los nombres según el servicio: <code>github_list_prs</code>, <code>slack_send_message</code>.</li><li><strong>Agrupa</strong> operaciones relacionadas en una herramienta con un parámetro <code>action</code> en vez de muchas casi idénticas.</li><li>Devuelve <strong>resultados con mucha señal</strong> e identificadores estables; no pidas parámetros de "razonamiento paso a paso" (pueden provocar un rechazo): pide una explicación breve.</li><li>Las definiciones de herramientas cuestan tokens de entrada en cada petición (más un pequeño system prompt automático): otro motivo para que sean concisas.</li></ul>'
        },
        code: `{
  "name": "crm_search_customers",
  "description": "Search customers in the CRM by name, email or customer ID. Use it before creating a ticket to check whether the customer already exists. Returns at most 10 matches with id, name, email and plan. Does not return billing data.",
  "input_schema": {
    "type": "object",
    "properties": {
      "query": {"type": "string", "description": "Name, email or ID, e.g. 'ana@acme.com'"},
      "limit": {"type": "integer", "description": "Max results (1-10). Default 5."}
    },
    "required": ["query"]
  }
}`
      },
      {
        title: { en: 'tool_choice and parallel calls', es: 'tool_choice y llamadas en paralelo' },
        body: {
          en: '<ul><li><code>{"type": "auto"}</code> — Claude decides (default when tools are provided).</li><li><code>{"type": "any"}</code> — must use one of the tools.</li><li><code>{"type": "tool", "name": "x"}</code> — must call that tool.</li><li><code>{"type": "none"}</code> — no tools (default when none are provided).</li></ul><p>With <code>any</code>/<code>tool</code> the response starts directly with <code>tool_use</code> (no natural-language preamble). Forced tool use is <strong>not compatible with manual extended thinking</strong>, and some of the newest models reject <code>any</code>/<code>tool</code> altogether — there, use <code>auto</code> + <code>strict: true</code>, or structured outputs. Changing <code>tool_choice</code> invalidates cached message blocks.</p><p>Claude can make <strong>parallel tool calls</strong> in one turn; return <strong>all</strong> the <code>tool_result</code> blocks in a <strong>single</strong> user message. <code>disable_parallel_tool_use: true</code> limits it to one call per turn.</p>',
          es: '<ul><li><code>{"type": "auto"}</code> — Claude decide (por defecto si hay herramientas).</li><li><code>{"type": "any"}</code> — debe usar alguna herramienta.</li><li><code>{"type": "tool", "name": "x"}</code> — debe llamar a esa herramienta.</li><li><code>{"type": "none"}</code> — sin herramientas (por defecto si no hay ninguna).</li></ul><p>Con <code>any</code>/<code>tool</code> la respuesta empieza directamente con <code>tool_use</code> (sin preámbulo en lenguaje natural). Forzar herramientas <strong>no es compatible con el extended thinking manual</strong>, y algunos de los modelos más nuevos rechazan <code>any</code>/<code>tool</code>: ahí usa <code>auto</code> + <code>strict: true</code>, o structured outputs. Cambiar <code>tool_choice</code> invalida los bloques de mensajes en caché.</p><p>Claude puede hacer <strong>llamadas en paralelo</strong> en un turno; devuelve <strong>todos</strong> los <code>tool_result</code> en un <strong>único</strong> mensaje de user. <code>disable_parallel_tool_use: true</code> lo limita a una llamada por turno.</p>'
        }
      },
      {
        title: { en: 'Returning tool results', es: 'Devolver resultados de herramientas' },
        body: {
          en: '<ul><li>Each result is a <code>tool_result</code> block with the matching <code>tool_use_id</code> and optional <code>content</code> (string or text/image/document blocks).</li><li><code>tool_result</code> blocks must <strong>immediately follow</strong> their <code>tool_use</code> and come <strong>first</strong> in the user message content; any text goes after them.</li><li>On failure or an invalid call, return <code>is_error: true</code> with a useful message ("Rate limit exceeded. Retry after 60 seconds."). Claude can retry or explain — cap retries in your loop.</li><li>Keep untrusted external content inside <code>tool_result</code> blocks to reduce indirect prompt-injection risk.</li></ul>',
          es: '<ul><li>Cada resultado es un bloque <code>tool_result</code> con el <code>tool_use_id</code> correspondiente y <code>content</code> opcional (texto o bloques de texto/imagen/documento).</li><li>Los bloques <code>tool_result</code> deben ir <strong>justo después</strong> de su <code>tool_use</code> y <strong>primero</strong> en el contenido del mensaje de user; cualquier texto va detrás.</li><li>Si hay fallo o llamada inválida, devuelve <code>is_error: true</code> con un mensaje útil ("Rate limit exceeded. Retry after 60 seconds."). Claude puede reintentar o explicarlo: limita los reintentos en tu bucle.</li><li>Mantén el contenido externo no fiable dentro de <code>tool_result</code> para reducir el riesgo de prompt injection indirecta.</li></ul>'
        }
      },
      {
        title: { en: 'Client tools vs server tools', es: 'Herramientas de cliente frente a herramientas de servidor' },
        body: {
          en: '<ul><li><strong>Client tools</strong> run in your code: your own tools, plus Anthropic-schema tools such as memory, bash, text editor and computer use. You get <code>stop_reason: tool_use</code> and must return results.</li><li><strong>Server tools</strong> run on Anthropic\'s infrastructure: <strong>web search, web fetch, code execution, tool search, MCP connector</strong>. Results come back inside the same response; some have usage fees (e.g. per search).</li><li>If a server-tool loop hits its iteration limit you get <code>pause_turn</code>: append the response content unchanged and resend to continue.</li><li><strong>Tool search</strong> lets Claude discover and load tools on demand when you have hundreds or thousands of them, instead of sending every definition every time.</li></ul>',
          es: '<ul><li>Las <strong>herramientas de cliente</strong> se ejecutan en tu código: las tuyas y las de esquema de Anthropic como memory, bash, text editor y computer use. Recibes <code>stop_reason: tool_use</code> y debes devolver los resultados.</li><li>Las <strong>herramientas de servidor</strong> se ejecutan en la infraestructura de Anthropic: <strong>web search, web fetch, code execution, tool search, conector MCP</strong>. Los resultados vuelven en la misma respuesta; algunas tienen coste por uso (p. ej. por búsqueda).</li><li>Si un bucle de herramientas de servidor llega a su límite de iteraciones recibes <code>pause_turn</code>: añade el contenido de la respuesta sin cambios y reenvía para continuar.</li><li><strong>Tool search</strong> permite a Claude descubrir y cargar herramientas bajo demanda cuando tienes cientos o miles, en lugar de enviar todas las definiciones cada vez.</li></ul>'
        }
      },
      {
        title: { en: 'Model Context Protocol (MCP)', es: 'Model Context Protocol (MCP)' },
        body: {
          en: '<p>MCP is an open standard to connect AI applications to external tools and data. <strong>Hosts</strong> (e.g. Claude Code, Claude Desktop, your app) contain <strong>clients</strong> that connect 1:1 to <strong>servers</strong>.</p><ul><li>Server primitives: <strong>tools</strong> (actions the model can call), <strong>resources</strong> (data the application can read and add to context), <strong>prompts</strong> (reusable templates, often exposed as slash commands).</li><li>Transports: <strong>stdio</strong> (local process) and <strong>Streamable HTTP</strong> (remote; older servers may use SSE).</li><li>Build an MCP server once and reuse it in any MCP-compatible host, instead of writing a custom integration per app.</li></ul><h4>MCP connector (Messages API, beta)</h4><ul><li>Connects to <strong>remote</strong> MCP servers without writing your own MCP client: <code>mcp_servers</code> (type <code>url</code>, <code>https://</code> URL, <code>name</code>, optional <code>authorization_token</code>) + an <code>mcp_toolset</code> entry in <code>tools</code>.</li><li>Supports <strong>only tool calls</strong> — not resources or prompts — and <strong>not local stdio servers</strong>.</li><li>Use <code>default_config</code>/<code>configs</code> on the toolset as an <strong>allowlist or denylist</strong> (e.g. disable destructive tools).</li><li>Responses contain <code>mcp_tool_use</code> and <code>mcp_tool_result</code> blocks.</li></ul>',
          es: '<p>MCP es un estándar abierto para conectar aplicaciones de IA con herramientas y datos externos. Los <strong>hosts</strong> (p. ej. Claude Code, Claude Desktop, tu app) contienen <strong>clientes</strong> que se conectan 1:1 a <strong>servidores</strong>.</p><ul><li>Primitivas del servidor: <strong>tools</strong> (acciones que el modelo puede llamar), <strong>resources</strong> (datos que la aplicación puede leer y añadir al contexto), <strong>prompts</strong> (plantillas reutilizables, a menudo como comandos con barra).</li><li>Transportes: <strong>stdio</strong> (proceso local) y <strong>Streamable HTTP</strong> (remoto; servidores antiguos pueden usar SSE).</li><li>Construyes un servidor MCP una vez y lo reutilizas en cualquier host compatible, en lugar de una integración a medida por app.</li></ul><h4>Conector MCP (Messages API, beta)</h4><ul><li>Se conecta a servidores MCP <strong>remotos</strong> sin escribir tu propio cliente MCP: <code>mcp_servers</code> (type <code>url</code>, URL <code>https://</code>, <code>name</code>, <code>authorization_token</code> opcional) + una entrada <code>mcp_toolset</code> en <code>tools</code>.</li><li>Solo admite <strong>llamadas a herramientas</strong> — no resources ni prompts — y <strong>no servidores stdio locales</strong>.</li><li>Usa <code>default_config</code>/<code>configs</code> del toolset como <strong>lista de permitidas o de bloqueadas</strong> (p. ej. desactivar herramientas destructivas).</li><li>Las respuestas contienen bloques <code>mcp_tool_use</code> y <code>mcp_tool_result</code>.</li></ul>'
        },
        code: `client.beta.messages.create(
    model="claude-opus-5-5", max_tokens=2000,
    messages=[{"role": "user", "content": "What meetings do I have tomorrow?"}],
    mcp_servers=[{"type": "url", "url": "https://calendar.example.com/mcp",
                  "name": "calendar", "authorization_token": TOKEN}],
    tools=[{"type": "mcp_toolset", "mcp_server_name": "calendar",
            "configs": {"delete_all_events": {"enabled": False}}}],
    betas=["mcp-client-2025-11-20"],
)`
      }
    ],
    keyFacts: [
      { en: 'Tool description quality is the #1 factor for tool performance.', es: 'La calidad de la descripción es el factor n.º 1 del rendimiento de una herramienta.' },
      { en: 'tool_choice: auto | any | tool | none. any/tool → no preamble.', es: 'tool_choice: auto | any | tool | none. any/tool → sin preámbulo.' },
      { en: 'All parallel tool_results go in ONE user message, before any text.', es: 'Todos los tool_result en paralelo van en UN mensaje de user, antes de cualquier texto.' },
      { en: 'is_error: true tells Claude the tool failed.', es: 'is_error: true indica a Claude que la herramienta falló.' },
      { en: 'strict: true guarantees tool inputs match the schema.', es: 'strict: true garantiza que la entrada cumple el esquema.' },
      { en: 'MCP primitives: tools, resources, prompts. Transports: stdio, Streamable HTTP.', es: 'Primitivas MCP: tools, resources, prompts. Transportes: stdio, Streamable HTTP.' },
      { en: 'MCP connector: remote HTTPS servers only, tools only.', es: 'Conector MCP: solo servidores HTTPS remotos y solo herramientas.' }
    ],
    docs: [
      'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview',
      'https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools',
      'https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls',
      'https://platform.claude.com/docs/en/agents-and-tools/mcp-connector',
      'https://modelcontextprotocol.io'
    ]
  },

  /* ===================================================================== */
  {
    id: 'security',
    weight: 8.1,
    name: { en: 'Security and Safety', es: 'Seguridad' },
    summary: {
      en: '<p>Protecting your application, your users and their data: prompt injection, least privilege, human approval, API key handling, data retention, refusals and supply-chain risks in skills and MCP servers.</p>',
      es: '<p>Proteger tu aplicación, a tus usuarios y sus datos: prompt injection, mínimo privilegio, aprobación humana, gestión de API keys, retención de datos, rechazos y riesgos de la cadena de suministro en skills y servidores MCP.</p>'
    },
    lessons: [
      {
        title: { en: 'Prompt injection', es: 'Prompt injection' },
        body: {
          en: '<p><strong>Direct</strong> injection comes from the user ("ignore your instructions…"). <strong>Indirect</strong> injection hides instructions in content the model reads: web pages, emails, documents, tool results.</p><p>No single defence is enough — layer them:</p><ul><li>Keep untrusted content in <code>tool_result</code> / clearly delimited tags, never in the system prompt.</li><li>Tell the model that instructions inside documents are data, not commands.</li><li><strong>Least privilege</strong>: the tools available should be the minimum needed; separate read and write tools.</li><li><strong>Human approval</strong> for sensitive actions (send, pay, delete, publish).</li><li>Validate and sanitise tool inputs server-side; never let the model build raw SQL or shell commands without checks.</li><li>Monitor and log; use a classifier or a second model as a screen for high-risk flows.</li></ul>',
          es: '<p>La inyección <strong>directa</strong> viene del usuario ("ignora tus instrucciones…"). La <strong>indirecta</strong> esconde instrucciones en contenido que lee el modelo: páginas web, emails, documentos, resultados de herramientas.</p><p>Ninguna defensa basta sola; combínalas:</p><ul><li>Pon el contenido no fiable en <code>tool_result</code> o en etiquetas bien delimitadas, nunca en el system prompt.</li><li>Indica al modelo que las instrucciones dentro de documentos son datos, no órdenes.</li><li><strong>Mínimo privilegio</strong>: las herramientas disponibles deben ser las mínimas necesarias; separa las de lectura y las de escritura.</li><li><strong>Aprobación humana</strong> para acciones sensibles (enviar, pagar, borrar, publicar).</li><li>Valida y sanea las entradas de las herramientas en el servidor; nunca dejes que el modelo construya SQL o comandos de shell sin comprobaciones.</li><li>Monitoriza y registra; usa un clasificador o un segundo modelo como filtro en flujos de alto riesgo.</li></ul>'
        }
      },
      {
        title: { en: 'Keys, environments and limits', es: 'Claves, entornos y límites' },
        body: {
          en: '<ul><li>Never put an API key in client-side code (browser or mobile app) or in a repository. Call the API from <strong>your backend</strong>, and keep keys in a secrets manager / environment variables.</li><li>Use separate <strong>workspaces</strong> and keys per environment or team; set workspace <strong>spend and rate limits</strong> to contain damage.</li><li>Rotate keys and revoke them immediately if leaked (a revoked key returns 401).</li><li>Don\'t put secrets (passwords, tokens) into prompts — the model may repeat them.</li></ul>',
          es: '<ul><li>Nunca pongas una API key en código de cliente (navegador o app móvil) ni en un repositorio. Llama a la API desde <strong>tu backend</strong> y guarda las claves en un gestor de secretos / variables de entorno.</li><li>Usa <strong>workspaces</strong> y claves distintas por entorno o equipo; pon <strong>límites de gasto y de uso</strong> por workspace para contener daños.</li><li>Rota las claves y revócalas de inmediato si se filtran (una clave revocada devuelve 401).</li><li>No metas secretos (contraseñas, tokens) en los prompts: el modelo podría repetirlos.</li></ul>'
        }
      },
      {
        title: { en: 'Data handling', es: 'Tratamiento de datos' },
        body: {
          en: '<ul><li><strong>Zero Data Retention (ZDR)</strong> and HIPAA eligibility depend on the feature. For example, prompt caching is ZDR-eligible, but the MCP connector and Agent Skills are <strong>not</strong>. Check eligibility before using a feature with regulated data.</li><li>With structured outputs, keep sensitive data (e.g. PHI) out of the <em>schema</em> (property names, enums) — it\'s cached; data belongs in message content.</li><li>Minimise and redact personal data before sending it when the task doesn\'t need it.</li></ul>',
          es: '<ul><li>La <strong>Zero Data Retention (ZDR)</strong> y la elegibilidad HIPAA dependen de cada función. Por ejemplo, el prompt caching es elegible para ZDR, pero el conector MCP y las Agent Skills <strong>no</strong>. Comprueba la elegibilidad antes de usar una función con datos regulados.</li><li>Con structured outputs, deja los datos sensibles (p. ej. datos de salud) fuera del <em>esquema</em> (nombres de propiedades, enums): se cachea; los datos van en el contenido del mensaje.</li><li>Minimiza y anonimiza los datos personales antes de enviarlos si la tarea no los necesita.</li></ul>'
        }
      },
      {
        title: { en: 'Refusals and harmful output', es: 'Rechazos y salidas dañinas' },
        body: {
          en: '<ul><li>A safety refusal comes back as <strong>HTTP 200</strong> with <code>stop_reason: "refusal"</code> (and details in <code>stop_details</code>). Handle it in code: show a safe message, offer to rephrase or route to a fallback — don\'t blindly retry the same request.</li><li>Add your own guardrails for your domain: input/output moderation, allowed-topic checks, and clear instructions in the system prompt about what the assistant should not do.</li></ul>',
          es: '<ul><li>Un rechazo de seguridad llega como <strong>HTTP 200</strong> con <code>stop_reason: "refusal"</code> (y detalles en <code>stop_details</code>). Gestiónalo en el código: muestra un mensaje seguro, ofrece reformular o pasa a una alternativa; no reintentes a ciegas la misma petición.</li><li>Añade tus propias salvaguardas para tu dominio: moderación de entrada/salida, comprobación de temas permitidos e instrucciones claras en el system prompt sobre lo que el asistente no debe hacer.</li></ul>'
        }
      },
      {
        title: { en: 'Supply chain: skills, MCP servers, plugins', es: 'Cadena de suministro: skills, servidores MCP, plugins' },
        body: {
          en: '<ul><li>Only use <strong>trusted</strong> Skills and MCP servers (written by you or from a trusted source). A malicious skill or server can direct Claude to call tools or run code against its stated purpose.</li><li><strong>Audit</strong> SKILL.md files, scripts and dependencies; watch for unexpected network calls or file access.</li><li>Content fetched from external URLs can carry injected instructions.</li><li>In Claude Code, use permission rules, deny rules and hooks to block dangerous commands; run unattended "bypass" modes only in isolated containers/VMs.</li></ul>',
          es: '<ul><li>Usa solo Skills y servidores MCP <strong>de confianza</strong> (tuyos o de una fuente fiable). Una skill o servidor malicioso puede hacer que Claude llame a herramientas o ejecute código contra su propósito declarado.</li><li><strong>Audita</strong> los SKILL.md, scripts y dependencias; vigila llamadas de red o accesos a ficheros inesperados.</li><li>El contenido descargado de URL externas puede traer instrucciones inyectadas.</li><li>En Claude Code, usa reglas de permisos, reglas deny y hooks para bloquear comandos peligrosos; usa los modos sin permisos ("bypass") solo en contenedores/VM aislados.</li></ul>'
        }
      }
    ],
    keyFacts: [
      { en: 'Indirect prompt injection = instructions hidden in data the model reads.', es: 'Prompt injection indirecta = instrucciones escondidas en datos que lee el modelo.' },
      { en: 'Defence in depth: least privilege + human approval + delimiting untrusted content + validation.', es: 'Defensa en profundidad: mínimo privilegio + aprobación humana + delimitar contenido no fiable + validación.' },
      { en: 'API keys only server-side; separate workspaces and spend limits.', es: 'API keys solo en el servidor; workspaces separados y límites de gasto.' },
      { en: 'Refusal = HTTP 200 + stop_reason "refusal".', es: 'Rechazo = HTTP 200 + stop_reason "refusal".' },
      { en: 'MCP connector and Agent Skills are not ZDR-eligible.', es: 'El conector MCP y las Agent Skills no son elegibles para ZDR.' }
    ],
    docs: [
      'https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview',
      'https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls'
    ]
  },

  /* ===================================================================== */
  {
    id: 'claudecode',
    weight: 3.1,
    name: { en: 'Claude Code', es: 'Claude Code' },
    summary: {
      en: '<p>A small domain, but easy points if you know the configuration basics: CLAUDE.md, permission modes and rules, hooks, sub-agents, skills, MCP and headless use in CI.</p>',
      es: '<p>Un área pequeña, pero son puntos fáciles si conoces lo básico de configuración: CLAUDE.md, modos y reglas de permisos, hooks, subagentes, skills, MCP y uso headless en CI.</p>'
    },
    lessons: [
      {
        title: { en: 'CLAUDE.md (memory)', es: 'CLAUDE.md (memoria)' },
        body: {
          en: '<ul><li>Loaded as <strong>context</strong> at the start of each session (guidance, not enforced config).</li><li>Locations: managed policy (organisation) · <code>~/.claude/CLAUDE.md</code> (you, all projects) · <code>./CLAUDE.md</code> or <code>./.claude/CLAUDE.md</code> (team, committed) · <code>./CLAUDE.local.md</code> (you, this project, gitignored).</li><li>Files found walking up from the working directory are <strong>concatenated</strong>; CLAUDE.md files in sub-directories load on demand when Claude reads files there.</li><li>Import other files with <code>@path/to/file</code>. <code>/init</code> generates a starter CLAUDE.md; <code>/memory</code> shows and edits loaded files.</li><li><code>.claude/rules/*.md</code> can be scoped to paths with <code>paths:</code> frontmatter.</li><li>Keep it short (~200 lines). For things that must <strong>always</strong> happen, use a hook, not CLAUDE.md.</li></ul>',
          es: '<ul><li>Se carga como <strong>contexto</strong> al empezar cada sesión (orientación, no configuración obligatoria).</li><li>Ubicaciones: política gestionada (organización) · <code>~/.claude/CLAUDE.md</code> (tú, todos los proyectos) · <code>./CLAUDE.md</code> o <code>./.claude/CLAUDE.md</code> (equipo, en el repo) · <code>./CLAUDE.local.md</code> (tú, este proyecto, en .gitignore).</li><li>Los ficheros encontrados subiendo desde el directorio de trabajo se <strong>concatenan</strong>; los CLAUDE.md de subdirectorios se cargan cuando Claude lee ficheros allí.</li><li>Importa otros ficheros con <code>@ruta/al/fichero</code>. <code>/init</code> genera un CLAUDE.md inicial; <code>/memory</code> muestra y edita los cargados.</li><li><code>.claude/rules/*.md</code> se pueden limitar a rutas con <code>paths:</code> en el frontmatter.</li><li>Mantenlo corto (~200 líneas). Lo que deba pasar <strong>siempre</strong> va en un hook, no en CLAUDE.md.</li></ul>'
        }
      },
      {
        title: { en: 'Permissions', es: 'Permisos' },
        body: {
          en: '<table><tr><th>Mode</th><th>Runs without asking</th></tr><tr><td><code>default</code></td><td>Reads only</td></tr><tr><td><code>acceptEdits</code></td><td>Reads, file edits, common file commands in the working dir</td></tr><tr><td><code>plan</code></td><td>Explore/read before changing anything</td></tr><tr><td><code>auto</code></td><td>Everything, with a classifier reviewing actions</td></tr><tr><td><code>dontAsk</code></td><td>Only pre-approved tools; anything else is denied (CI)</td></tr><tr><td><code>bypassPermissions</code></td><td>Everything — isolated containers/VMs only</td></tr></table><p>Rules: <code>allow</code>, <code>ask</code>, <code>deny</code> (e.g. <code>Bash(npm test)</code>, <code>Edit(.claude/**)</code>). <strong>Deny rules block in every mode</strong>, even bypass. Switch modes with Shift+Tab or <code>--permission-mode</code>.</p>',
          es: '<table><tr><th>Modo</th><th>Se ejecuta sin preguntar</th></tr><tr><td><code>default</code></td><td>Solo lecturas</td></tr><tr><td><code>acceptEdits</code></td><td>Lecturas, ediciones y comandos de ficheros comunes en el directorio de trabajo</td></tr><tr><td><code>plan</code></td><td>Explorar/leer antes de cambiar nada</td></tr><tr><td><code>auto</code></td><td>Todo, con un clasificador revisando las acciones</td></tr><tr><td><code>dontAsk</code></td><td>Solo herramientas preaprobadas; lo demás se deniega (CI)</td></tr><tr><td><code>bypassPermissions</code></td><td>Todo — solo en contenedores/VM aislados</td></tr></table><p>Reglas: <code>allow</code>, <code>ask</code>, <code>deny</code> (p. ej. <code>Bash(npm test)</code>, <code>Edit(.claude/**)</code>). <strong>Las reglas deny bloquean en todos los modos</strong>, incluso bypass. Cambia de modo con Shift+Tab o <code>--permission-mode</code>.</p>'
        }
      },
      {
        title: { en: 'Hooks', es: 'Hooks' },
        body: {
          en: '<p>Hooks run your code at lifecycle events — <strong>deterministic</strong>, unlike CLAUDE.md instructions.</p><ul><li>Key events: <code>PreToolUse</code>, <code>PostToolUse</code>, <code>UserPromptSubmit</code>, <code>Stop</code>, <code>SubagentStop</code>, <code>SessionStart</code>, <code>PreCompact</code>, <code>Notification</code>.</li><li>Configured in <code>settings.json</code> (user <code>~/.claude/</code>, project <code>.claude/</code>, local, managed) with a <code>matcher</code> (tool name, list or regex).</li><li>A command hook that <strong>exits with code 2</strong> blocks the action and sends stderr to Claude. Or exit 0 with JSON, e.g. <code>permissionDecision: "deny"</code> for <code>PreToolUse</code>.</li><li>Typical uses: block dangerous commands, auto-format after edits (<code>PostToolUse</code>), run lint/tests, notify.</li></ul>',
          es: '<p>Los hooks ejecutan tu código en eventos del ciclo de vida: son <strong>deterministas</strong>, a diferencia de las instrucciones de CLAUDE.md.</p><ul><li>Eventos clave: <code>PreToolUse</code>, <code>PostToolUse</code>, <code>UserPromptSubmit</code>, <code>Stop</code>, <code>SubagentStop</code>, <code>SessionStart</code>, <code>PreCompact</code>, <code>Notification</code>.</li><li>Se configuran en <code>settings.json</code> (usuario <code>~/.claude/</code>, proyecto <code>.claude/</code>, local, gestionado) con un <code>matcher</code> (nombre de herramienta, lista o regex).</li><li>Un hook de comando que <strong>termina con código 2</strong> bloquea la acción y envía stderr a Claude. O termina con 0 y JSON, p. ej. <code>permissionDecision: "deny"</code> en <code>PreToolUse</code>.</li><li>Usos típicos: bloquear comandos peligrosos, formatear tras editar (<code>PostToolUse</code>), lanzar lint/tests, notificar.</li></ul>'
        }
      },
      {
        title: { en: 'Sub-agents, skills, MCP and headless mode', es: 'Subagentes, skills, MCP y modo headless' },
        body: {
          en: '<ul><li><strong>Sub-agents</strong>: Markdown files with YAML frontmatter in <code>.claude/agents/</code> (project) or <code>~/.claude/agents/</code> (user). Required: <code>name</code>, <code>description</code>; optional <code>tools</code> (allowlist), <code>model</code>. Each runs in its <strong>own context window</strong>. Built-ins: Explore (read-only), Plan, general-purpose.</li><li><strong>Skills</strong>: folders with a <code>SKILL.md</code> (frontmatter <code>name</code> + <code>description</code>) in <code>.claude/skills/</code> or <code>~/.claude/skills/</code>. Progressive disclosure: only metadata (~100 tokens) loads at start; the body loads when triggered; bundled files load only when needed.</li><li><strong>MCP</strong>: project servers in <code>.mcp.json</code>; MCP tools are named <code>mcp__&lt;server&gt;__&lt;tool&gt;</code>.</li><li><strong>Headless</strong>: <code>claude -p "…"</code> with <code>--output-format json</code>, <code>--allowedTools</code> and <code>--permission-mode dontAsk</code> for an exact allowlist in CI.</li></ul>',
          es: '<ul><li><strong>Subagentes</strong>: ficheros Markdown con frontmatter YAML en <code>.claude/agents/</code> (proyecto) o <code>~/.claude/agents/</code> (usuario). Obligatorios: <code>name</code>, <code>description</code>; opcionales <code>tools</code> (lista permitida), <code>model</code>. Cada uno trabaja en su <strong>propia ventana de contexto</strong>. Integrados: Explore (solo lectura), Plan, general-purpose.</li><li><strong>Skills</strong>: carpetas con un <code>SKILL.md</code> (frontmatter <code>name</code> + <code>description</code>) en <code>.claude/skills/</code> o <code>~/.claude/skills/</code>. Carga progresiva: al inicio solo se cargan los metadatos (~100 tokens); el cuerpo cuando se activa; los ficheros adjuntos solo cuando hacen falta.</li><li><strong>MCP</strong>: servidores del proyecto en <code>.mcp.json</code>; las herramientas MCP se llaman <code>mcp__&lt;servidor&gt;__&lt;herramienta&gt;</code>.</li><li><strong>Headless</strong>: <code>claude -p "…"</code> con <code>--output-format json</code>, <code>--allowedTools</code> y <code>--permission-mode dontAsk</code> para una lista exacta en CI.</li></ul>'
        },
        code: `# CI: only allow running tests and reading files; everything else is denied
claude -p "Run the test suite and summarise failures" \\
  --permission-mode dontAsk \\
  --allowedTools "Bash(npm test)" "Read" \\
  --output-format json`
      }
    ],
    keyFacts: [
      { en: 'CLAUDE.md = guidance (context). Hooks = guaranteed execution.', es: 'CLAUDE.md = orientación (contexto). Hooks = ejecución garantizada.' },
      { en: 'CLAUDE.local.md = personal, not committed.', es: 'CLAUDE.local.md = personal, no se sube al repo.' },
      { en: 'Hook exit code 2 = block.', es: 'Hook con código de salida 2 = bloquear.' },
      { en: 'Deny rules apply in every permission mode.', es: 'Las reglas deny se aplican en todos los modos.' },
      { en: 'Headless: claude -p … --output-format json.', es: 'Headless: claude -p … --output-format json.' }
    ],
    docs: [
      'https://code.claude.com/docs/en/memory',
      'https://code.claude.com/docs/en/hooks',
      'https://code.claude.com/docs/en/sub-agents',
      'https://code.claude.com/docs/en/permission-modes'
    ]
  },

  /* ===================================================================== */
  {
    id: 'evals',
    weight: 2.6,
    name: { en: 'Eval, Testing, and Debugging', es: 'Evals, pruebas y depuración' },
    summary: {
      en: '<p>The smallest domain: defining success criteria, building evaluations, choosing a grading method and debugging API integrations.</p>',
      es: '<p>El área más pequeña: definir criterios de éxito, construir evaluaciones, elegir el método de corrección y depurar integraciones con la API.</p>'
    },
    lessons: [
      {
        title: { en: 'Success criteria and eval design', es: 'Criterios de éxito y diseño de evals' },
        body: {
          en: '<ul><li>Good criteria are <strong>specific, measurable, achievable and relevant</strong>. "Sentiment F1 ≥ 0.85 on 1,000 labelled tweets" — not "works well".</li><li>Most use cases need several dimensions: accuracy, consistency, tone, latency, cost, privacy…</li><li>Evals should be <strong>task-specific</strong> (mirror real traffic, include edge cases), <strong>automated</strong> where possible, and favour <strong>volume</strong>: many auto-graded cases beat a few hand-graded ones.</li><li>Cycle: test cases → prompt → run → refine → validate on a <strong>held-out</strong> set before shipping. Re-run evals when you change the prompt or the model.</li></ul>',
          es: '<ul><li>Los buenos criterios son <strong>específicos, medibles, alcanzables y relevantes</strong>. "F1 de sentimiento ≥ 0,85 en 1.000 tuits etiquetados", no "funciona bien".</li><li>La mayoría de casos necesitan varias dimensiones: precisión, consistencia, tono, latencia, coste, privacidad…</li><li>Las evals deben ser <strong>específicas de la tarea</strong> (reflejar el tráfico real, incluir casos límite), <strong>automáticas</strong> cuando sea posible y priorizar el <strong>volumen</strong>: muchos casos corregidos automáticamente valen más que unos pocos corregidos a mano.</li><li>Ciclo: casos de prueba → prompt → ejecutar → mejorar → validar con un conjunto <strong>reservado</strong> (held-out) antes de publicar. Repite las evals al cambiar el prompt o el modelo.</li></ul>'
        }
      },
      {
        title: { en: 'Grading methods', es: 'Métodos de corrección' },
        body: {
          en: '<ol><li><strong>Code-based</strong> (exact match, string contains, JSON validity, unit tests): fastest, most reliable, most scalable — but no nuance.</li><li><strong>LLM-based</strong> ("LLM-as-judge"): fast and flexible for complex judgments. Use a <strong>clear rubric</strong>, ask for a constrained output (correct/incorrect or 1–5), let the grader reason/think before scoring, and preferably use a <strong>different model</strong> from the one being tested. Validate it against human labels first.</li><li><strong>Human</strong>: highest quality but slow and expensive — use sparingly.</li></ol>',
          es: '<ol><li><strong>Por código</strong> (coincidencia exacta, contiene texto, JSON válido, tests unitarios): el más rápido, fiable y escalable, pero sin matices.</li><li><strong>Con un LLM</strong> ("LLM como juez"): rápido y flexible para juicios complejos. Usa una <strong>rúbrica clara</strong>, pide una salida acotada (correct/incorrect o 1–5), deja que el corrector razone/piense antes de puntuar y, mejor, usa un <strong>modelo distinto</strong> del evaluado. Valídalo antes con etiquetas humanas.</li><li><strong>Humano</strong>: máxima calidad, pero lento y caro: úsalo con moderación.</li></ol>'
        }
      },
      {
        title: { en: 'Debugging integrations', es: 'Depurar integraciones' },
        body: {
          en: '<ul><li>Always log the <code>request-id</code>, model, <code>stop_reason</code> and <code>usage</code> of each call.</li><li>Unexpected truncation → check <code>stop_reason == "max_tokens"</code>.</li><li>Caching not working → check <code>cache_creation_input_tokens</code> / <code>cache_read_input_tokens</code> and look for changing content before the breakpoint.</li><li>"tool_use ids were found without tool_result blocks immediately after" → fix message ordering.</li><li>Costs higher than expected → inspect usage (thinking tokens are output tokens; tool definitions add input tokens).</li><li>Use the Token Counting API to check prompt size, and the Console Workbench to iterate on prompts.</li></ul>',
          es: '<ul><li>Registra siempre el <code>request-id</code>, el modelo, el <code>stop_reason</code> y el <code>usage</code> de cada llamada.</li><li>Respuestas cortadas inesperadamente → comprueba <code>stop_reason == "max_tokens"</code>.</li><li>El caché no funciona → revisa <code>cache_creation_input_tokens</code> / <code>cache_read_input_tokens</code> y busca contenido que cambie antes del breakpoint.</li><li>"tool_use ids were found without tool_result blocks immediately after" → corrige el orden de los mensajes.</li><li>Costes mayores de lo esperado → revisa el usage (los tokens de thinking son de salida; las definiciones de herramientas suman tokens de entrada).</li><li>Usa la Token Counting API para comprobar el tamaño del prompt y el Workbench de la Console para iterar prompts.</li></ul>'
        }
      }
    ],
    keyFacts: [
      { en: 'Prefer code-based grading → LLM grading → human grading.', es: 'Prioridad: corrección por código → con LLM → humana.' },
      { en: 'Volume over quality for test cases; include edge cases.', es: 'Volumen antes que perfección en los casos de prueba; incluye casos límite.' },
      { en: 'LLM judge: rubric, constrained output, reason first, different model.', es: 'LLM juez: rúbrica, salida acotada, razonar primero, modelo distinto.' },
      { en: 'Always log request-id, stop_reason and usage.', es: 'Registra siempre request-id, stop_reason y usage.' }
    ],
    docs: [
      'https://platform.claude.com/docs/en/test-and-evaluate/develop-tests'
    ]
  }
];
