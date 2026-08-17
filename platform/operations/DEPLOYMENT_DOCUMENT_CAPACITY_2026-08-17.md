# Despliegue de capacidad documental

Fecha: 17 de agosto de 2026.

## Alcance

- Se elimina el límite funcional de tres documentos por expediente.
- Se eleva a 25 MB el tamaño máximo por archivo de cliente e interno.
- Una petición documental admite entregas sucesivas.
- El expediente conserva todos sus documentos, pero el asistente procesa
  temporalmente tandas de hasta 3 PDF y 10 MB combinados por ejecución para
  evitar agotamiento de memoria mientras se implanta el índice documental.

## Fuente

- Commit de `main`: `c0e99851fdfc2ebc3881c41d789dd3a99071c2e9`.
- Migración: `20260817143000_expand_case_document_capacity.sql`.

## Evidencia de Supabase

- Proyecto comprobado por referencia: `bvpeztdfwdbiielaione`.
- La ejecución de la migración fue confirmada como correcta en el editor SQL
  antes de iniciar el despliegue de funciones.
- `document-workflow`: activa, versión 19.
- `internal-document-workflow`: activa, versión 12.
- `ai-assist`: activa, versión 46.
- Las tres funciones conservan la validación interna de sesión y rol; el
  verificador JWT de pasarela permanece desactivado conforme a la arquitectura
  vigente.

## Pruebas realizadas

- Flujo documental de cliente: aprobado.
- Flujo de documentación interna y cuarentena: aprobado.
- Asistente de IA y límites de contexto: aprobado.
- Seguridad estática: aprobada.
- Configuración de producción: aprobada.
- Interfaz en escritorio y móvil: aprobada localmente.

No se utilizaron datos personales ni expedientes reales en estas pruebas.

## Pendiente para cierre de publicación

- Publicar desde el mismo commit la interfaz del CRM y del portal.
- Verificar en las URLs corporativas que ambos muestran el límite de 25 MB y
  permiten una segunda entrega sobre la misma solicitud.
- Ejecutar una prueba autenticada con un PDF sintético y comprobar la
  cronología, auditoría y descarga temporal.

La publicación de interfaz no se declara terminada hasta completar esas tres
comprobaciones.

## Incidencia posterior y corrección

La primera prueba real de la versión 46 devolvió
`AI_TEMPORARILY_UNAVAILABLE`. El único cambio de esa versión frente a la que
funcionaba era elevar de 3 PDF y 10 MB a 10 PDF y 45 MB el contenido cargado en
una sola ejecución. Debido a la expansión de base64 y las copias en memoria, se
prepara una versión de corrección que recupera la tanda estable sin reducir la
capacidad de almacenamiento del expediente ni el límite de 25 MB por archivo.

La corrección se desplegó como `ai-assist` versión 47 y quedó activa. La prueba
funcional autenticada posterior sigue siendo obligatoria antes de cerrar la
incidencia.
