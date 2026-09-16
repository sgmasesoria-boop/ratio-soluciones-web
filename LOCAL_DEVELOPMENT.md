# Desarrollo local seguro de Ratio

## Windows

Entorno comprobado: Node 24.19.0, npm 11.17.0 y pnpm 10.34.5. Las dependencias
están fijadas en pnpm-lock.yaml. Desde la raíz del repositorio:

```powershell
pnpm.cmd install --frozen-lockfile --ignore-scripts
pnpm.cmd run build
pnpm.cmd --dir platform run build
pnpm.cmd --dir platform run build:crm
pnpm.cmd --dir platform run build:portal
pnpm.cmd run test:offline
```

Si la caché ya está disponible, añadir `--offline` a la instalación evita el
registro de paquetes. No actualizar dependencias para resolver diferencias de
máquina. Usar `pnpm.cmd` evita depender de la política de scripts de PowerShell.
Las compilaciones regeneran únicamente los directorios dist y no despliegan.
La plataforma compila por defecto con configuración pública de producción:
no abrir ese resultado para trabajo offline. Para explorar la interfaz local,
construir explícitamente demo desde platform; desde PowerShell:

```powershell
Push-Location platform
node build.mjs combined '' demo
Pop-Location
```

## Pruebas offline

`qa-offline-tests.mjs` mantiene una lista explícita de suites revisadas. No se
seleccionan archivos nuevos automáticamente. Quedan excluidas invitaciones,
pruebas live y scripts operativos. La suite comprueba la selección y el bloqueo
de navegador antes de continuar. Si fallan, se detiene.

La QA usa Edge instalado en Windows y Chromium de Playwright en otros sistemas.
CHROME_PATH permite seleccionar otro ejecutable local. Se requiere un navegador
instalado; instalarlo es una preparación separada, no parte de la QA offline.
Los contextos bloquean solicitudes externas no simuladas y service workers;
las API se sustituyen por mocks. Algunas suites comprueban código y migraciones
estáticamente: no prueban RLS, rendimiento SQL ni rate limiting en una base real.
No se consideran una certificación de seguridad de producción.

La exportación crea una carpeta nueva dentro de platform/.qa-document-export;
rechaza destinos existentes o externos y nunca elimina el destino recibido.
Las QA de backup usan datos ficticios y carpetas temporales; no invocan asistentes
PowerShell ni acceden a archivos archivados. No requieren credenciales.

## Variables y servicios externos

`platform/.env.example` es un inventario comentado con valores vacíos. Los scripts
Node no lo cargan automáticamente. No crear ni copiar un .env real para la QA.
Para Supabase, la configuración de servidor se gestiona por su mecanismo de
variables de entorno; no se ha configurado ni conectado en esta finalización.
Referencia: https://supabase.com/docs/guides/functions/secrets

La generación contractual exige RATIO_CONTRACT_ISSUER_NAME,
RATIO_CONTRACT_ISSUER_IDENTIFIER y RATIO_CONTRACT_ISSUER_ADDRESS. El envío exige
además RATIO_CONTRACT_REPLY_TO y la configuración de Signaturit. Sin identidad
explícita, incluso el PDF de borrador falla con CONTRACT_ISSUER_NOT_CONFIGURED.
No se usan identidades personales ni correos incrustados como alternativa.
CONTRACT_TEMPLATE_VALIDATED requiere validación jurídica independiente; no
activarlo como solución a un error técnico. Los contratos y PDFs ya persistidos
no se han modificado ni se migran automáticamente.

Las configuraciones públicas ya existentes contienen URL y clave publicable de
Supabase. No son credenciales de servidor, pero abrir la aplicación en modo
producción puede conectar el servicio. No ejecutar test:invite, scripts live,
asistentes de backup, envíos, webhooks ni despliegues durante desarrollo offline.

## Privacidad y límites pendientes

La identidad incrustada en la función contractual y su plantilla se sustituye
por configuración. Se conserva pendiente de decisión del titular el aviso legal
público legal.html y los textos de privacidad de index.html y platform/index.html.
Contienen identificación del responsable; legal.html incluye también identidad
fiscal y domicilio. Cambiarlos por una identidad ficticia alteraría el contenido
informativo publicado. El correo
corporativo público continúa en las páginas y funciones de comunicación donde
actúa como contacto comercial. No se certifica su autorización de publicación.

Los valores anteriores siguen en el historial Git; este trabajo no reescribe
historial. Revisar acceso al repositorio y una posible política de saneamiento
histórico es una decisión separada. No se han añadido documentos de clientes.
Los fixtures nuevos usan datos expresamente ficticios.

Nunca subir .env, claves, bases exportadas, backups, restauraciones, evidencias
privadas, documentos de clientes, biblioteca jurídica, OCR privado, material
DPAPI ni manifiestos del archivo privado. Las copias históricas y el USB quedan
fuera del proyecto y no se abren ni modifican durante QA.

## Backup y restauración

Ver los runbooks de platform/operations. Los clientes PostgreSQL se resuelven
mediante RATIO_POSTGRES_BIN, PATH o ProgramFiles/PostgreSQL/17/bin. Las carpetas
se seleccionan explícitamente; no dependen de un usuario ni de una unidad externa
fija. El identificador de proyecto esperado se conserva como barrera de seguridad,
no como secreto. Las herramientas de backup real requieren credenciales y una
operación explícita; no forman parte del arranque local.

Las restauraciones verifican la copia antes de crear salida, usan carpetas nuevas,
rechazan solapamiento con el origen y escriben sin sobrescribir. Una extracción
fallida elimina solo su carpeta recién creada. Restaurar aquí significa extraer
archivos localmente, no importar SQL ni reponer objetos en Supabase.

No se ha comprobado la existencia actual de backups reales ni su recuperabilidad.
No ejecutar una restauración real hasta autorizar destino, credenciales y alcance.
