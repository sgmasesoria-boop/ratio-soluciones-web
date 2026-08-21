# Seguridad del portal simplificado

Este documento define requisitos de producción. Que un control aparezca aquí no significa que esté activo: el estado verificable se mantiene en `IMPLEMENTATION_STATUS.md`.

## Identidad y acceso

- Alta solo por invitación.
- Confirmación de correo obligatoria.
- MFA obligatorio para administradores y profesionales.
- Sesiones limitadas y revocables.
- Acceso por expediente y mínimo privilegio.
- El acceso del cliente exige simultáneamente contrato confirmado, portal en
  estado `invited` o `active` y expediente abierto. Las funciones Edge deben
  repetir esta condición además de la protección RLS de la base de datos.
- Las funciones internas verifican el token con Supabase Auth y exigen AAL2 y
  perfil administrador activo antes de usar la clave de servicio.

## Minimización

- El portal solo acepta documentación vinculada a un expediente y a una
  petición concreta. Cada envío exige lectura y aceptación del aviso de
  privacidad aplicable.
- Los archivos admitidos se limitan a PDF, DOCX, JPEG y PNG, con comprobación
  de firma binaria y un máximo de 25 MB por archivo.
- Los documentos se guardan en buckets privados. No existen políticas de
  lectura directa desde el navegador; las descargas usan enlaces firmados de
  60 segundos emitidos después de comprobar sesión y acceso al expediente.
- Se conservan los datos identificativos, contractuales, actuaciones,
  solicitudes, documentos y trazas estrictamente necesarios para prestar y
  acreditar el servicio.
- Las notificaciones externas no incluyen detalles sensibles.
- Los textos de cronología deben evitar datos innecesarios de salud, menores, cuentas o terceros.
- La limitación del formulario público conserva huellas HMAC de correo e IP,
  no los valores originales dentro de la tabla de control de abuso.

## Inteligencia artificial

- El análisis de expedientes y documentos solo puede iniciarlo un administrador
  con MFA.
- Los índices y resultados de IA son tablas internas sin permisos para `anon`
  ni `authenticated`; el acceso queda reservado a las funciones del servidor.
- La salida de IA es material de apoyo y debe someterse a revisión humana antes
  de usarse o remitirse.
- Deben mantenerse documentados el proveedor, finalidad, categorías de datos,
  región, conservación, contrato de encargo y transferencias aplicables.

## Auditoría y continuidad

- Las altas y los cambios sensibles quedan registrados en la auditoría interna.
- Los accesos y fallos de autenticación deberán conservarse mediante los registros de Supabase con una retención aprobada antes de producción.
- La auditoría es append-only.
- Copia diaria de la base de datos.
- Prueba trimestral de restauración.
- Procedimiento documentado de incidentes y revocación de accesos.
- La copia de base de datos no sustituye la copia de los objetos de Storage.
  La continuidad exige dos destinos externos cifrados e independientes y una
  restauración controlada comprobada.

## Privacidad

- Registro de actividades de tratamiento.
- Análisis de riesgos antes de producción.
- Contratos con proveedores y colaboradores.
- Política de conservación y eliminación.
- Procedimiento de ejercicio de derechos.
- Contrato de encargo y verificación de transferencias para cada proveedor.
- Revisión semestral de la necesidad y conservación de los datos del CRM.

## Última comprobación técnica

Comprobación de solo lectura realizada el 21 de agosto de 2026:

- Todas las tablas de aplicación del esquema `public` tienen RLS activo.
- `anon` no tiene lectura ni escritura sobre las tablas de aplicación.
- `authenticated` conserva únicamente las lecturas protegidas por RLS y la
  actualización limitada de avisos prevista por el sistema.
- Los buckets documentales son privados y restringen tamaño y tipos admitidos.
- Los avisos actuales del asesor de seguridad son informativos y corresponden
  a tres tablas internas de IA deliberadamente sin políticas ni permisos de
  usuario. Conviene añadir una denegación RLS explícita como defensa adicional.
- Sigue pendiente restringir de forma explícita los permisos heredados de
  ejecución de dos funciones auxiliares privadas y fijar su `search_path` antes
  de dar por cerrado el endurecimiento de base de datos.
