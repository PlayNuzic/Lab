# Nuzic LoRA — Briefing para Entrenamiento

> Documento de entrada para el informático que entrenará un LoRA (Low-Rank
> Adaptation) sobre Llama (3.1 / 3.2) con el sistema visual Nuzic.

---

## 1. Objetivo

Fine-tuning con LoRA para que el modelo genere apps web educativas de
rítmica/música (frontend HTML+CSS+JS) siguiendo el **sistema visual Nuzic**:
paleta de colores, componentes reutilizables, layouts de timeline/plano,
editores cell-based, etc.

El modelo entrenado debe:

- Aplicar el estilo Nuzic **por defecto** ante cualquier petición relacionada
  con apps de música/ritmo (sin necesidad de prompt especial).
- Componer features de forma libre (plano con/sin compás, con/sin fracción,
  con/sin escalas, etc.) en lugar de copiar apps fijas.
- **Incluir siempre el botón de aleatorización** (`setupRandomMenu`) en
  toda app interactiva con parámetros. Es un elemento estructural del
  sistema Nuzic, no opcional — forma parte de la identidad pedagógica.
- Responder en el **idioma de la consulta** del usuario. Castellano es el
  idioma de trabajo del equipo, pero el dataset incluye ejemplos en
  catalán, inglés, francés, italiano y alemán para que el modelo
  generalice esta capacidad.

---

## 2. Archivos entregados

Dos archivos en `docs/`:

| Archivo | Tamaño | Propósito |
|---|---|---|
| `Nuzic-AI-Reference.md` | ~85 KB / ~2 600 líneas | Base de conocimiento canónica. Documento de referencia humano-legible con todos los patterns, recipes y pitfalls. **No es el dataset de entrenamiento**, es la fuente desde la que se derivan los pairs del JSONL. |
| `nuzic-training.jsonl` | 227 KB / 132 pairs | Dataset de fine-tuning. Una línea = un ejemplo de entrenamiento. Cada línea es un objeto JSON válido con un campo `messages`. |

---

## 3. Formato del JSONL

Una línea por par de entrenamiento. Cada línea es un objeto JSON con un campo
`messages` que contiene exactamente **2 mensajes**: uno de `user` y uno de
`assistant`.

```jsonl
{"messages":[{"role":"user","content":"Genera el CSS de un endcap amarillo Nuzic."},{"role":"assistant","content":"```css\n.timeline::before { ... }\n```"}]}
{"messages":[{"role":"user","content":"How do I add halters under note-bars?"},{"role":"assistant","content":"Import `createIntervalLabelBar`..."}]}
```

**Decisión técnica clave**: NO hay `system` prompt en ningún par. Esto
significa que el LoRA codificará el estilo Nuzic **en los pesos** de forma
incondicional. Al inferir, el modelo aplicará el estilo por defecto sin
necesidad de pasar un system prompt especial.

Si se quisiera comportamiento condicional (el modelo solo aplica Nuzic
cuando un system prompt lo indica), habría que **re-generar el JSONL con
system prompt**. La opción actual es la más simple para "el modelo siempre
hace Nuzic".

---

## 4. Cómo cargar el dataset

### Con HuggingFace `datasets`:

```python
from datasets import load_dataset

dataset = load_dataset("json", data_files="docs/nuzic-training.jsonl", split="train")
print(dataset[0])
# {'messages': [{'role': 'user', 'content': '...'}, {'role': 'assistant', 'content': '...'}]}
```

### Aplicar chat template (Llama 3):

```python
from transformers import AutoTokenizer

tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3.1-8B-Instruct")

def format_example(ex):
    return {"text": tokenizer.apply_chat_template(ex["messages"], tokenize=False, add_generation_prompt=False)}

dataset = dataset.map(format_example)
```

Esto produce strings con los tokens especiales de Llama 3:
`<|start_header_id|>user<|end_header_id|>\n\n{user}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n\n{assistant}<|eot_id|>`

---

## 5. Hyperparámetros sugeridos (punto de partida)

```python
from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=16,                                      # LoRA rank
    lora_alpha=32,                             # scaling
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    # Para style transfer más fuerte, incluir también:
    # target_modules += ["gate_proj", "up_proj", "down_proj"]
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM"
)

training_args = {
    "learning_rate": 2e-4,
    "num_train_epochs": 4,                     # 132 examples × 4 = 528 steps
    "per_device_train_batch_size": 2,
    "gradient_accumulation_steps": 4,          # efectivo batch = 8
    "warmup_ratio": 0.03,
    "lr_scheduler_type": "cosine",
    "max_grad_norm": 1.0,
    "logging_steps": 10,
    "save_strategy": "epoch",
    "bf16": True,                              # si la GPU soporta
}
```

### Modelo target sugerido

- **Llama 3.1 8B Instruct** — buena balance calidad/velocidad para style
  transfer. Encaja en GPUs de 24 GB con QLoRA.
- Alternativas: Llama 3.2 3B (más rápido, menos calidad) o Llama 3.1 70B
  (más calidad pero requiere más VRAM).

---

## 6. Workflow recomendado

1. **Cargar y formatear el dataset** (script anterior).
2. **Aplicar el chat template** del modelo target.
3. **Entrenar el LoRA** con PEFT + transformers Trainer (o TRL SFTTrainer
   para más automatización).
4. **Evaluar** con prompts de test (sección 9).
5. **Decidir**: mantener como adapter LoRA (más flexible, swap on/off) o
   fusionar en el modelo base (`peft.merge_and_unload`).

---

## 7. Estadísticas del dataset

| Métrica | Valor |
|---|---|
| Total pairs válidos | 132 |
| Tamaño JSONL | 227 KB |
| Tokens estimados (suma user+assistant) | ~135 000 |
| Longitud promedio por par | ~1 000 tokens |
| Distribución de idiomas (aprox.) | 50% catalán · 30% castellano · 12% inglés · 8% otros (francés, italiano, alemán, portugués) |

### Cobertura temática (pairs aproximados)

- ~28 pairs — Componentes aislados (endcaps, fraction editor, halter, info pills, dots, ghost-pulses, playhead, controls, etc.)
- ~25 pairs — Apps starter completas (timeline, plano-2D simple, plano-2D complex, soundline vertical, etc.)
- ~25 pairs — Combinaciones de 2 features
- ~24 pairs — **Random menu / setupRandomMenu / filosofía de aleatorización** (parámetros por familia de app, pitfalls, API, multi-idioma)
- ~10 pairs — Combinaciones de 3+ features
- ~10 pairs — Decisiones/elecciones de biblioteca
- ~10 pairs — Pitfalls con síntoma/causa/fix

---

## 8. Posibles problemas y mitigaciones

### 8.1 Desequilibrio lingüístico (catalán dominante)

El dataset todavía tiene más ejemplos en catalán que en castellano,
aunque la nueva batch de aleatorización (24 pairs) corrige parcialmente
el sesgo. **Distribución actual**: ~50% catalán, ~30% castellano, ~12%
inglés, ~8% otros (francés, italiano, alemán). **Posible sesgo**: el
modelo entrenado puede inclinarse a responder en catalán a preguntas
ambiguas.

**Mitigación**: Si la evaluación muestra este sesgo, generar un batch
adicional de ~50-100 pairs monolingües en castellano (re-frasear pairs
existentes traduciéndolos). El código en sí no cambia entre idiomas — solo
los comentarios y el texto natural de la respuesta.

### 8.2 Dataset pequeño (132 pairs)

Para style transfer LoRA típicamente funciona con 100-500 pairs. 132 es
suficiente para una primera iteración. Si la calidad es insuficiente,
ampliar a ~250 pairs extrayendo más secciones del Markdown.

### 8.3 Tokens especiales en código

Los bloques de código están escapados correctamente (`\n` para saltos de
línea, `\"` para comillas dobles dentro de strings). El tokenizer de
Llama maneja esto correctamente. Verificación incluida en commit:

```bash
python3 -c "
import json
with open('docs/nuzic-training.jsonl') as f:
    for i, line in enumerate(f, 1):
        json.loads(line.strip())  # validates every line
print('All 132 lines valid JSON')
"
```

### 8.4 Conocimiento de URLs/paths

El dataset incluye paths como `libs/shared-ui/interval-label-bar.js`. El
modelo aprenderá estos como literales, pero **NO** verificará que existan
realmente — son referencias documentales del proyecto Nuzic Lab. El
informático puede sustituir o adaptar paths según donde el modelo se vaya
a usar.

---

## 9. Prompts de evaluación sugeridos (held-out)

Después del fine-tuning, probar con estos prompts (NO incluidos en el
training set):

**Castellano**:
- "Genera el código completo de una app Nuzic con timeline horizontal,
  fracción compleja editable, y un editor Pfr cell-based."
- "¿Por qué necesito `gap: 0` en `.fraction-editor-wrapper` para fracción
  compleja?"
- "Crea el CSS para hacer las celdas del editor cuadradas en una app
  plano-2D."

**Català**:
- "Crea una app de plànol amb multi-registres, fracció simple, i scale-pill
  per canviar d'escala."
- "Per què les meves note-bars no es veuen durant playback?"

**English**:
- "Build a percussion practice app with simple fraction and drag-to-create
  notes."
- "How do I align the playhead exactly with pulse-numbers?"
- "What's the difference between musical-grid and plano-modular?"

**Criterios de éxito**:
- El código generado usa la paleta `--nuzic-*` (no colores aleatorios).
- El layout incluye `body data-visual="nuzic" data-theme="light"`.
- Los componentes citados (endcaps, halter, info-pills) tienen la estructura
  correcta documentada.
- El idioma de los comentarios coincide con el idioma del prompt.

---

## 10. Cómo ampliar el dataset

Si quieres más pairs, hay dos opciones:

### Opción A: Manual (calidad alta)

Editar `docs/nuzic-training.jsonl` directamente añadiendo pairs nuevos. Mantener
el formato: una línea por par, JSON válido.

### Opción B: Generación automática desde el Markdown

El Markdown está estructurado consistentemente con:

- `### Pattern: NAME` o `### Recipe N — NAME` como headers.
- `**Purpose**:` o `**Why**:` para el contexto.
- ` ```css ... ``` ` o ` ```javascript ... ``` ` para los bloques de código.
- `**Pitfalls**:` para problemas conocidos.

Un script Python puede extraer cada sección y generar pairs `(question, answer)`
sintéticos con plantillas:

```python
# Pseudo-código
for section in extract_sections(markdown):
    pair = {
        "messages": [
            {"role": "user", "content": f"How do I create {section.title}?"},
            {"role": "assistant", "content": section.code + "\n\n" + section.purpose}
        ]
    }
    write_jsonl(pair)
```

Esto puede multiplicar los 132 pairs actuales a 200-500 fácilmente. Cada
pattern en el Markdown puede generar 2-3 pairs (en distintos idiomas o con
diferentes framing de la pregunta).

---

## 11. Contacto y referencias

- **Repositorio fuente**: PlayNuzic Lab (Apps/App9 — App35).
- **Estilo visual de referencia**: ver cualquier app del 9 al 35 desplegada.
- **Filosofía**: documentada en la sección 1 de `Nuzic-AI-Reference.md`.

Si hay dudas sobre la intención de un pattern o decisión de diseño, consultar
primero la sección correspondiente en `Nuzic-AI-Reference.md`. Si no está
claro, abrir issue / preguntar.

---

*Generado: 2026-05-15. Versión: 1.1 (añade 24 pairs de aleatorización + sección Random en Markdown).*
