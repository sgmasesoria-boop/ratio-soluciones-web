# Migración de la IA del CRM: de OpenAI a Claude (Anthropic)

Fecha: 20 de octubre de 2026. Motivo: Ratio abandona el ecosistema OpenAI (cuenta de ChatGPT cancelada, reclamación abierta). La función de lectura de documentos devolvía `AI_QUOTA_EXCEEDED` porque la clave de OpenAI se había quedado sin cuota.

## Qué cambia

| Pieza | Antes | Ahora |
|---|---|---|
| Cliente de IA | `api.openai.com/v1/responses` (código repetido en dos funciones) | Módulo único `supabase/functions/_shared/claude.ts` → `api.anthropic.com/v1/messages` |
| Salida estructurada | `json_schema` estricto | Herramienta obligatoria con el mismo esquema (`tool_choice`) |
| PDF / imágenes | URL firmada (`input_file`, `input_image`) | URL firmada (`document`, `image`) |
| Word (DOCX) | Aceptado | Se convierte a texto en el servidor antes de enviarlo (Claude no lee DOCX de forma nativa) |
| Investigación oficial | Búsqueda web de OpenAI con dominios permitidos | Herramienta `web_search` de Claude con `allowed_domains` (mismos dominios oficiales) |
| Secreto | `OPENAI_API_KEY` | `ANTHROPIC_API_KEY` |
| Límite mensual | `OPENAI_MONTHLY_HARD_LIMIT_USD` (25) | `ANTHROPIC_MONTHLY_HARD_LIMIT_USD` (25) |
| Interruptor de emergencia | `OPENAI_DOCUMENT_ANALYSIS_DISABLED` | `ANTHROPIC_DOCUMENT_ANALYSIS_DISABLED` |

Modelos por defecto (cambiables sin tocar código): triaje `claude-haiku-4-5-20251001`; lectura de documentos `claude-sonnet-5-5`; trabajo profesional `claude-opus-5-5`. Variables: `ANTHROPIC_TRIAGE_MODEL`, `ANTHROPIC_DOCUMENT_INDEX_MODEL`, `ANTHROPIC_PROFESSIONAL_MODEL`. Las tarifas por millón de tokens (`ANTHROPIC_{TRIAGE,DOCUMENT,PROFESSIONAL}_{INPUT,OUTPUT}_USD_PER_MILLION`) son orientativas: comprobar los precios vigentes en la consola y ajustarlas para que el control de gasto sea fiel.

No cambian: esquema de base de datos, permisos (administrador con MFA/AAL2), URLs firmadas de 5 minutos, minimización de identificadores, auditoría, reintentos máximos ni la interfaz del CRM. Los códigos de error `AI_*` se conservan, de modo que los mensajes del CRM siguen valiendo. Saldo agotado en Anthropic (HTTP 400 «credit balance is too low») se traduce a `AI_QUOTA_EXCEEDED`.

## Puesta en marcha (una sola vez)

1. Crear la cuenta en console.anthropic.com con el correo corporativo, organización «Ratio Soluciones».
2. Facturación: añadir método de pago y crédito inicial; fijar un límite de gasto mensual en la consola (además del límite propio de 25 USD).
3. Consola → Privacidad/ajustes de la organización: permitir la herramienta de búsqueda web (necesaria para la investigación en fuentes oficiales).
4. Crear una clave de API (nombre: `ratio-supabase`). Copiarla una sola vez.
5. Supabase → Edge Functions → Secrets: crear `ANTHROPIC_API_KEY`. Después borrar `OPENAI_API_KEY` y el resto de variables `OPENAI_*`.
6. Desplegar `ai-assist`, `document-indexer` y, por incluir el módulo compartido actualizado, el resto de funciones que importan `_shared/http.ts` (quita de las orígenes CORS los dominios `*.chatgpt.site` de Sites).
7. Prueba: en un expediente real con documentos, pulsar «Preparar documentación» y comprobar que el índice queda `completed`; después «Trabajar con el expediente».
8. Prueba sintética sin datos personales: acción `test_document_pipeline` de `ai-assist` (PDF ficticio).
9. Revocar la clave de OpenAI y cancelar su facturación cuando acabe la reclamación.

## Pruebas automáticas

- `deno test --allow-env supabase/functions/_shared/claude.test.ts` (simula la API; no consume saldo).
- `node document-index-qa.mjs`, `node ai-qa.mjs`, `node professional-assistant-qa.mjs`, `node ai-context-qa.mjs`, `node security-qa.mjs`. Para los que abren navegador: `RATIO_BROWSER_PATH=/ruta/a/chrome`.

## Datos y privacidad

El proveedor de IA ha cambiado, así que el aviso legal (`legal.html`) se actualiza. Debe validarlo un profesional: encargado del tratamiento, transferencias internacionales y condiciones de retención de la API de Anthropic vigentes en la fecha de uso.
