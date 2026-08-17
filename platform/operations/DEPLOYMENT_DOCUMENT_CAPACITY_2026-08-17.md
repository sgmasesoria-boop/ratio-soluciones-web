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

## Causa raíz confirmada

La consulta técnica posterior confirmó que el fallo de las versiones 46 y 47
se producía antes de contactar con el servicio de IA. La función consultaba los
campos de revisión de seguridad de `case_internal_documents`, pero la migración
`20260816183000_internal_document_security_review.sql` todavía no constaba en
la base de datos de producción. El error se convertía en el mensaje genérico y
no se emitía una traza de fallo, por lo que no aparecía como registro rojo.

Correcciones aplicadas:

- migración de revisión de seguridad aplicada con éxito, sin eliminar archivos;
- cuatro columnas de seguridad comprobadas en producción;
- `ai-assist` versión 48 activa;
- registro seguro de fase, código técnico y referencia de trabajo, sin nombres,
  textos de consulta ni contenido documental;
- respuesta incompleta y fallo de guardado diferenciados del fallo temporal;
- aviso visible cuando la cobertura documental de una ejecución no es completa.

Los documentos internos existentes quedan en `pending_review` por diseño. No
se envían al análisis hasta que un administrador los descargue, compruebe y
marque expresamente como seguros. La prueba autenticada y la revisión de los
documentos del expediente siguen pendientes; no se declara aún el análisis
integral como verificado.
