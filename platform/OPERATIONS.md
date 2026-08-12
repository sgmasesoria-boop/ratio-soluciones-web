# Operativa mínima

Las supresiones, bloqueos y limpiezas se ejecutan conforme a `DATA_ERASURE_PROTOCOL.md`. No se improvisan borrados desde el CRM, SQL Editor ni Storage.

## Alta

1. Ratio acepta realizar el estudio inicial.
2. Un administrador con doble factor crea el cliente y expediente.
3. El cliente recibe una invitación de un solo uso.
4. Confirma el correo y establece su contraseña.
5. El expediente aparece inicialmente como `Abierto`.

Si la consulta inicial llegó únicamente con teléfono, el gestor solicitará y registrará el correo antes de convertirla en expediente, porque la invitación al portal exige confirmar una dirección de correo.

## Asignación profesional

1. Ratio confirma el profesional que intervendrá.
2. Verifica identidad, habilitación y acuerdo de colaboración.
3. Registra nombre, función, acreditación y territorio.
4. La identidad aparece al cliente dentro del expediente.

## Avances

Los estados de una consulta solo pueden mantenerse o avanzar. No se permite retroceder a un estado anterior; `No viable / cerrada` puede seleccionarse desde cualquier estado, incluso `Contratada`, mientras todavía no se haya creado el expediente. Después de la conversión, cualquier cierre se gestiona desde el propio expediente.

No existe una fecha manual de seguimiento en la ficha. Cada cambio de estado y cada nota interna se incorporan al historial con la fecha, la hora y el usuario reales registrados por el sistema.

Cada actualización debe indicar:

- Título claro de la actuación realizada.
- Información comprensible para el cliente.
- Lo que necesitamos del cliente, si existe.
- Profesional asignado actualizado, cuando corresponda.

No se introducen fechas previstas que no puedan garantizarse.

## Documentación

La documentación se solicita y entrega exclusivamente dentro del portal privado:

1. El administrador crea una solicitud vinculada al expediente.
2. El cliente recibe un aviso y consulta el detalle en su plataforma.
3. Antes de subir el archivo, el cliente debe leer y confirmar el aviso de privacidad vigente.
4. El portal admite únicamente PDF, JPG y PNG, con un máximo de 5 MB por archivo.
5. El archivo se guarda en un contenedor privado y el acceso genera una URL temporal de corta duración.
6. Solicitud, entrega, revisión y descarga quedan registradas cronológicamente.

No se aceptan documentos por correo electrónico, WhatsApp u otros canales paralelos.

## Cierre

El gestor marca el expediente como cerrado y registra el último avance. La cuenta y los metadatos se conservarán o eliminarán conforme a la política aprobada y a las obligaciones aplicables.

## Revisiones

- Mensual: usuarios internos, accesos y expedientes asignados.
- Trimestral: permisos, dependencias y prueba de recuperación de base de datos.
- Antes de cada alta profesional: habilitación, contrato y mínimo privilegio.
- Antes del lanzamiento: análisis de riesgos y revisión legal.
- Antes del lanzamiento: pruebas RLS con una cuenta cliente, una profesional y una administradora; ninguna cuenta debe poder consultar o modificar datos fuera de su función.
# Piloto de IA interno

- El botón `Analizar consulta` solo aparece dentro del CRM.
- El triaje de consultas envía a OpenAI categoría, provincia, resumen y estado; excluye nombre, teléfono y correo.
- El análisis de expedientes envía la ficha minimizada, consulta inicial, notas, cronología, solicitudes, respuestas y metadatos de documentos. Excluye nombre, teléfono, correo, DNI y rutas de almacenamiento.
- Cada análisis del expediente se conserva en `case_ai_runs` con fuentes, modelo, versión del prompt, consumo y coste estimado. La tabla es de solo servicio y el historial es inmutable.
- La función usa `store:false`, exige administrador con AAL2 y nunca modifica el expediente ni envía comunicaciones.
- El piloto comenzó con un PDF ficticio y continuó con un único expediente autorizado. Tras verificar la lectura y los eventos de auditoría, el 12 de agosto de 2026 se autorizó la lectura documental para todos los expedientes.
- El análisis siempre se inicia manualmente por un administrador con AAL2. Solo procesa PDF validados: máximo tres, 5 MB por archivo y 10 MB combinados. Se usa `store:false`, se registra cada documento procesado y toda salida requiere revisión humana.
- Interruptor de emergencia: establecer `OPENAI_DOCUMENT_ANALYSIS_DISABLED=true` detiene la lectura de documentos en todos los expedientes sin desactivar el resto del asistente.
- El resultado es una sugerencia: no decide viabilidad, no envía mensajes y no cambia datos automáticamente.
- Cada uso queda auditado con modelo, consumo y coste estimado.
- El límite mensual predeterminado es 25 USD y puede reducirse con `OPENAI_MONTHLY_HARD_LIMIT_USD`.
- La clave se guarda únicamente como secreto `OPENAI_API_KEY` de Supabase.
