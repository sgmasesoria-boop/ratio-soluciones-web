# Operativa mínima

Las supresiones, bloqueos y limpiezas se ejecutan conforme a `DATA_ERASURE_PROTOCOL.md`. No se improvisan borrados desde el CRM, SQL Editor ni Storage.

## Alta y acceso

1. El formulario o el equipo crea un expediente interno desde el primer contacto.
2. Ratio estudia el asunto dentro de ese mismo expediente; todavía no existe acceso del cliente.
3. La situación se escribe libremente y las notas se acumulan en la cronología real.
4. Si existe contratación, un administrador con AAL2 confirma expresamente el contrato y activa el portal.
5. Solo entonces el cliente recibe la invitación de un solo uso, confirma el correo y establece su contraseña.

Teléfono y correo son obligatorios en la operativa aprobada. La cuenta de Auth no se crea antes de la contratación.

## Asignación profesional

1. Ratio confirma el profesional que intervendrá.
2. Verifica identidad, habilitación y acuerdo de colaboración.
3. Registra nombre, función, acreditación y territorio.
4. La identidad aparece al cliente dentro del expediente.

## Comunicaciones con el cliente y el profesional

1. Ratio y el portal son el canal ordinario de coordinación. El cliente puede solicitar una aclaración o una llamada desde su expediente.
2. La solicitud recoge asunto, explicación, posible notificación o plazo y disponibilidad orientativa. Queda fechada y no puede modificarse ni borrarse por el cliente.
3. El CRM avisa al equipo sin incluir información sensible en el asunto del correo. La respuesta se registra en el expediente y genera un aviso al cliente.
4. No se publican teléfonos personales ni correos particulares de los profesionales. Sí se muestra su identidad, función y acreditación cuando corresponda.
5. Ratio no bloquea la comunicación entre cliente y profesional. Si el encargo, una decisión, una comparecencia, un plazo o las obligaciones profesionales requieren contacto directo, Ratio lo coordina y el profesional informa al cliente.
6. Las llamadas se conciertan cuando sea posible. Una solicitud en el portal no equivale a una atención inmediata ni sustituye el canal de urgencia específicamente comunicado para el asunto.
7. Los profesionales no deben mantener conversaciones materiales fuera del registro: después de una llamada o reunión se incorpora una nota o avance con lo relevante y la fecha real.
8. La hoja de encargo identificará quién presta el servicio, el medio para comunicarse con él o con su despacho y el reparto de funciones y responsabilidades. Ratio no debe presentarse como prestador jurídico cuando el servicio corresponda a un profesional habilitado distinto.

## Avances

No existe un embudo de fases premarcado. Ratio escribe la situación actual que corresponda a cada asunto. El estado general solo puede ser `Abierto`, `No contratado` o `Archivado`:

- `Abierto`: comprende el estudio inicial y, si se firma, toda la ejecución del encargo.
- `No contratado`: cierra el expediente cuando no se formaliza el servicio.
- `Archivado`: cierra un expediente contratado después de terminar el trabajo.

La contratación se registra por separado mediante el contrato firmado; no convierte el expediente en otro tipo ni cambia por sí sola su estado `Abierto`.

## Contrato y firma

1. El expediente permanece `Abierto` durante el estudio inicial.
2. Ratio prepara el contrato estándar desde la ficha: identidad del firmante, causa, precio y descripción manual del trabajo.
3. Las cláusulas generales proceden de una plantilla aprobada y versionada; el contrato conserva una copia exacta de esa versión.
4. Ratio puede escribir una anotación libre sobre la situación del contrato; no existe una lista de estados contractuales.
5. Una vez revisado, el PDF se envía mediante el proveedor de firma electrónica integrado y el sistema registra la fecha real del envío.
6. Un webhook autenticado recupera el PDF firmado y el expediente de evidencias, comprueba sus huellas y registra la fecha real de la firma.
7. Solo cuando existen esas evidencias el expediente continúa `Abierto` y se permite activar el portal.

No existe un botón interno para simular la firma. Una anotación, una casilla, una firma dibujada sin evidencias o una fecha introducida manualmente no bastan para acreditar la firma del contrato.

No existe una fecha manual de seguimiento en la ficha. Cada cambio de estado y cada nota interna se incorporan al historial con la fecha, la hora y el usuario reales registrados por el sistema.

Cada actualización debe indicar:

- Título claro de la actuación realizada.
- Información comprensible para el cliente.
- Lo que necesitamos del cliente, si existe.
- Profesional asignado actualizado, cuando corresponda.

No se introducen fechas previstas que no puedan garantizarse.

## Documentos de trabajo y borradores

1. Cada escrito, demanda, recurso, contrato u otro documento se crea con título, tipo y anotación libres.
2. Cada modificación genera una versión nueva numerada automáticamente.
3. Cinco borradores producen cinco versiones conservadas; ninguna sobrescribe a otra.
4. El contenido, el motivo del cambio, el autor y la fecha quedan vinculados a la versión.
5. Las versiones son internas por defecto. La futura publicación al cliente será una acción expresa y auditada.
6. El análisis API puede usar la versión más reciente de cada documento dentro de límites de coste; nunca guarda automáticamente su propuesta como versión definitiva.

## Documentación interna de Ratio

1. «Documentación interna» se reserva para archivos de trabajo de Ratio: informes internos, borradores auxiliares, notas técnicas o material que no deba mostrarse al cliente.
2. Un documento aportado por el cliente nunca se clasifica como interno, aunque Ratio lo reciba en papel o en mano.
3. Se admiten PDF, DOCX, JPG y PNG de hasta 15 MB; se rechazan extensiones ejecutables y contenidos cuya firma no coincide con el formato declarado.
4. Cada archivo conserva título, nota, autor, fecha, tamaño y huella SHA-256.
5. La subida y cada descarga exigen cuenta administrativa con AAL2 y quedan auditadas. Los enlaces de descarga caducan a los 60 segundos.
6. Los archivos no deben abrirse fuera de equipos protegidos. La validación de formato no sustituye un sistema antimalware; antes de ampliar el uso a archivos de terceros deberá incorporarse escaneo de malware.

## Documentación

La documentación se solicita y entrega exclusivamente dentro del portal privado:

1. El administrador crea una solicitud vinculada al expediente.
2. El cliente recibe un aviso y consulta el detalle en su plataforma.
3. Antes de subir el archivo, el cliente debe leer y confirmar el aviso de privacidad vigente.
4. El portal admite PDF, DOCX, JPG y PNG, con un máximo de 5 MB por archivo.
5. El archivo se guarda en un contenedor privado y el acceso genera una URL temporal de corta duración.
6. Solicitud, entrega, revisión y descarga quedan registradas cronológicamente.

Si el cliente entrega documentación en papel o en mano, el administrador usa «Incorporar documento recibido», confirma que se ha facilitado la información de privacidad y el sistema registra que la incorporación fue realizada por Ratio. Los envíos digitales ordinarios siguen realizándose por el portal, no por correo electrónico o WhatsApp.

## Cierre

El gestor marca el expediente como cerrado y registra el último avance. La cuenta y los metadatos se conservarán o eliminarán conforme a la política aprobada y a las obligaciones aplicables.

## Revisiones

- Mensual: usuarios internos, accesos y expedientes asignados.
- Trimestral: permisos, dependencias y prueba de recuperación de base de datos.
- Antes de cada alta profesional: habilitación, contrato y mínimo privilegio.
- Antes del lanzamiento: análisis de riesgos y revisión legal.
- Antes del lanzamiento: pruebas RLS con una cuenta cliente, una profesional y una administradora; ninguna cuenta debe poder consultar o modificar datos fuera de su función.
# Piloto de IA interno

- Existe un único botón de análisis dentro del expediente.
- El análisis envía la ficha minimizada, información inicial, notas, cronología, solicitudes, respuestas, PDF autorizados del cliente, PDF internos y la versión más reciente de los documentos de trabajo. Excluye nombre, teléfono, correo, DNI y rutas de almacenamiento de los campos estructurados.
- Para responder a una carencia del análisis o corregir un dato, usar «Aportar información al análisis». La aclaración se guarda como evento interno `ai_context`, con autor y fecha, y se incorpora automáticamente a los análisis posteriores. Si corrige un dato previo debe indicar expresamente qué dato sustituye.
- Cada análisis del expediente se conserva en `case_ai_runs` con fuentes, modelo, versión del prompt, consumo y coste estimado. La tabla es de solo servicio y el historial es inmutable.
- La ficha tiene un único asistente integral. Sin instrucción realiza una revisión completa; con una instrucción libre puede calcular, contrastar legislación, revisar un borrador o preparar demandas, recursos, reclamaciones, alegaciones y otros escritos.
- El asistente trabaja en dos fases: primero obtiene dentro del entorno privado un informe del expediente; después formula consultas jurídicas anónimas limitadas a organismos oficiales y combina esas fuentes con el informe privado. Nunca se envía el expediente completo al buscador.
- Las conclusiones y borradores no se comunican ni presentan automáticamente. «Guardar como documento de trabajo» crea una versión nueva, vinculada al análisis que la originó y marcada como pendiente de revisión profesional. Las versiones anteriores no se sobrescriben.
- Las fuentes oficiales deben mostrarse como enlaces visibles. Una referencia normativa sin URL oficial verificada no debe presentarse como comprobada.
- La función usa `store:false`, exige administrador con AAL2 y nunca modifica el expediente ni envía comunicaciones.
- El piloto comenzó con un PDF ficticio y continuó con un único expediente autorizado. Tras verificar la lectura y los eventos de auditoría, el 12 de agosto de 2026 se autorizó la lectura documental para todos los expedientes.
- El análisis siempre se inicia manualmente por un administrador con AAL2. Solo lee el contenido de PDF validados o incorporados por el equipo: toma los tres más recientes entre documentación del cliente e interna, con 5 MB por archivo y 10 MB combinados. DOCX e imágenes se incluyen como metadatos, pero su contenido no se lee todavía. Se usa `store:false`, se registra cada documento procesado y toda salida requiere revisión humana.
- Interruptor de emergencia: establecer `OPENAI_DOCUMENT_ANALYSIS_DISABLED=true` detiene la lectura de documentos en todos los expedientes sin desactivar el resto del asistente.
- El resultado es una sugerencia: no decide viabilidad, no envía mensajes y no cambia datos automáticamente.
- Cada uso queda auditado con modelo, consumo y coste estimado.
- El límite mensual predeterminado es 25 USD y puede reducirse con `OPENAI_MONTHLY_HARD_LIMIT_USD`.
- Para contener coste y contexto, se incluyen como máximo 12 documentos de trabajo y 60.000 caracteres de borradores; cualquier recorte se registra en auditoría.
- La clave se guarda únicamente como secreto `OPENAI_API_KEY` de Supabase.
