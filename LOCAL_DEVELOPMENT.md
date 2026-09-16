# Desarrollo local y migración — 2026-09-16

Base comprobada: `migrated/ratio-consolidation-20260916`, commit `7242425`.
Node 24.19.0, npm 11.17.0 y pnpm 10.34.5 disponibles. Las dependencias instaladas
Playwright 1.62.1 y docx 9.7.1 coinciden con `pnpm-lock.yaml`; no fue necesaria
una reinstalación. Para una instalación nueva, desde la raíz:

```powershell
pnpm install --frozen-lockfile
npm run build
npm run test:offline
```

`test:offline` construye web, CRM y portal y ejecuta todas las QA locales,
incluidas las que no tenían entrada en package.json. Excluye archivos live.
Los navegadores bloquean peticiones externas no simuladas y service workers;
las pruebas de API y backups usan fixtures/mocks. Los builds son artefactos
locales y no despliegan. Los directorios dist son regenerables.

El navegador de QA usa Edge instalado en Windows y Chromium de Playwright en
otros sistemas. `CHROME_PATH` permite seleccionar un ejecutable instalado.
En otro equipo puede requerirse instalar el navegador de Playwright antes de QA.
No hay rutas personales ni rutas fijas de Program Files en las pruebas.
La prueba `qa-browser.test.mjs` comprueba bloqueo externo, mocks y loopback.

## Configuración

`platform/.env.example` contiene únicamente nombres con valores vacíos. Es un
inventario, no un archivo cargado automáticamente. La QA no necesita credenciales.
No copiar archivos .env del ordenador antiguo; .env y sus variantes locales se
excluyen de Git. Las configuraciones públicas de producción existentes no son
credenciales de servidor y no se usan para conectar servicios en esta verificación.
Los nombres del ejemplo cubren las funciones y los scripts operativos; que una
variable figure allí no significa que sea necesaria para todos los componentes.

## Backup y restauración

Las QA cifran y restauran datos ficticios en carpetas temporales, sin conectar
Supabase. Database backup supera 11 controles; Storage verifica el ciclo cifrado,
integridad, aislamiento y rechazo de fallos. Los destinos reales se seleccionan
explícitamente, fuera del repositorio, y la restauración evita sobrescribir.
No se han ejecutado asistentes de backup real, restauraciones reales ni DPAPI.

El asistente de backup de base de datos resuelve `psql.exe` y `pg_dump.exe` desde
`RATIO_POSTGRES_BIN`, PATH o ProgramFiles/PostgreSQL/17/bin. Ambos deben pertenecer
a la misma instalación compatible con el servidor. En este PC no se han encontrado
clientes PostgreSQL en PATH ni en Program Files: el backup de producción queda
pendiente de provisionar esos clientes y autorizar conexión/credenciales.
No son necesarios para compilar ni para las QA con datos ficticios.
La sintaxis del asistente se ha comprobado sin ejecutarlo.

Los 97 archivos privados archivados siguen fuera del repositorio. No copiar ni
publicar biblioteca jurídica, OCR, backups, documentos privados o material DPAPI.
Las carpetas antiguas y el USB son fuentes de conservación de solo lectura.

## Correcciones de esta rama

Selección portable y aislamiento de navegador en 17 entradas de QA; expectativa
de prompt de ai-context actualizada de v9 a v10, preservando todas las aserciones
semánticas; plantilla sin valores reales; exclusión de .env; resolución portable
de herramientas PostgreSQL. No se cambió el código de las funciones de producción.
