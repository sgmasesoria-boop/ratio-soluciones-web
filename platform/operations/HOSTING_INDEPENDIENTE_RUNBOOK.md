# Alojamiento independiente de Sites (OpenAI) — web, CRM y portal

## Por qué

El workspace de negocio "Ratio Soluciones" en ChatGPT se desactiva el 16/10/2026 (cancelación intencional). Antes de esa fecha, y en paralelo a los casos de soporte abiertos por el conflicto de dominio (`custom_domain_conflict`, casos 15260444/15872052), se traslada el alojamiento de los tres dominios fuera de Sites de OpenAI, a infraestructura que Sergio controla directamente. El proyecto ya compila a archivos estáticos (`npm run build` → `dist/`), así que no depende técnicamente de ninguna plataforma concreta.

## Web pública — www.ratiosoluciones.es — ✅ Automatizado

- Workflow: `.github/workflows/pages.yml`. Compila con `node build.mjs` y publica `dist/` en GitHub Pages en cada push a `main` que toque los archivos públicos.
- El archivo `CNAME` en la raíz del repo ya contiene `www.ratiosoluciones.es` — GitHub Pages lo detecta automáticamente.
- Pendiente solo de Sergio:
  1. Fusionar el PR que añade este workflow.
  2. En GitHub → Settings → Pages del repositorio, confirmar que el origen es "GitHub Actions" (puede que ya quede así automáticamente al fusionar, si no, un clic).
  3. En el DNS de Arsys, apuntar `www.ratiosoluciones.es` a GitHub Pages:
     - Registro CNAME: `www` → `sgmasesoria-boop.github.io`
     - Para el dominio raíz (`ratiosoluciones.es` sin `www`), GitHub Pages recomienda registros A a sus IPs: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
  4. Esperar la validación SSL automática de GitHub Pages (unos minutos tras el DNS correcto).

## CRM — crm.ratiosoluciones.es — ⏳ Pendiente de un repositorio nuevo

No se puede crear un repositorio nuevo desde este entorno (restricción de seguridad deliberada: ninguna automatización puede crear infraestructura o credenciales nuevas sin que el propietario lo apruebe con su propia cuenta). Para activarlo:

1. Sergio crea un repositorio vacío en GitHub: `ratio-soluciones-crm` (público o privado, da igual para Pages).
2. Sergio añade ese repositorio a la instalación de la GitHub App que ya usa Claude/Codex en este proyecto (Settings de la app → Repository access → añadir `ratio-soluciones-crm`), o simplemente lo indica aquí y se completa el despliegue en la siguiente sesión.
3. Con acceso al repo, se empuja automáticamente: el build `platform/build.mjs crm` + un workflow equivalente a `pages.yml` + `CNAME` con `crm.ratiosoluciones.es`.
4. DNS en Arsys: CNAME `crm` → `sgmasesoria-boop.github.io` (con el "Project site" correspondiente al nuevo repo, GitHub Pages lo resuelve por el contenido del `CNAME`).

## Portal de clientes — clientes.ratiosoluciones.es — ⏳ Pendiente de un repositorio nuevo

Mismo procedimiento que el CRM, con repositorio `ratio-soluciones-clientes`, build `platform/build.mjs portal` y `CNAME` con `clientes.ratiosoluciones.es`.

## Notas

- Los tres despliegues son independientes entre sí: la web pública puede quedar lista y en producción sin esperar a CRM/Portal.
- El `dist/server/index.js` y `dist/.openai/hosting.json` que generan los scripts de build son específicos de Sites de OpenAI y no se usan en GitHub Pages; no estorban, simplemente no se sirven.
- Las variables de entorno/config de producción (`platform/config.production.public.js`) no contienen secretos — las credenciales reales de Supabase siguen fuera del repositorio, como hasta ahora.
- Una vez verificados los tres dominios en GitHub Pages, se puede continuar con el punto 4 del orden de ejecución (publicar versiones consolidadas y verificar dominios).
