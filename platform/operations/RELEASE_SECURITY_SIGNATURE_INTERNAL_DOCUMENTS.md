# Publicación controlada: firma y documentos internos

Fecha de preparación: 17 de agosto de 2026.

Esta publicación agrupa tres cambios que deben desplegarse y comprobarse juntos:

1. los avisos de Signaturit dejan de depender de un secreto visible en la URL;
2. cada documento interno queda en revisión antes de que la IA pueda leerlo;
3. la licencia de OpenAI API se trata como un coste separado de Codex y ChatGPT.

No se considerará terminada por el mero hecho de fusionar el código. La prueba
autenticada, el registro de auditoría y la comprobación pública forman parte de
la publicación.

## Estado de partida

- Rama preparada: `agent/endurecer-firma-documentos-2026-08-16`.
- Confirmar antes de publicar que `main` no contiene cambios posteriores
  incompatibles.
- Migración nueva:
  `20260816183000_internal_document_security_review.sql`.
- Funciones que cambian:
  `signaturit-webhook`, `internal-document-workflow` y `ai-assist`.
- Interfaz que cambia: CRM privado. El portal del cliente no muestra los
  documentos internos ni sus decisiones de seguridad.

## Condiciones previas

- Utilizar solo un expediente y documentos totalmente ficticios.
- Disponer de un administrador real con MFA AAL2.
- Confirmar que el token configurado pertenece al sandbox de Signaturit.
- Conservar una copia de las versiones activas de las tres funciones.
- No activar el portal de ningún cliente real durante la prueba.
- No usar documentación real para probar análisis, firma ni descargas.

## Orden de publicación

1. Fusionar la rama en `main` y comprobar que GitHub conserva exactamente el
   mismo commit que se va a publicar.
2. Aplicar la migración de revisión de documentos internos.
3. Desplegar `internal-document-workflow`.
4. Desplegar `ai-assist`.
5. Desplegar `signaturit-webhook`.
6. Configurar:

   `SIGNATURIT_EVENTS_URL=https://bvpeztdfwdbiielaione.supabase.co/functions/v1/signaturit-webhook/events.json`

7. Eliminar `SIGNATURIT_WEBHOOK_TOKEN` solo después de comprobar que no existe
   ninguna referencia activa a la URL antigua.
8. Compilar y publicar el CRM desde el mismo commit ya guardado en `main`.
9. Ejecutar las pruebas obligatorias de este documento.

## Prueba obligatoria A: documento interno

1. Abrir un expediente ficticio con un administrador y MFA.
2. Subir un PDF sintético, sin datos personales.
3. Comprobar que aparece como `Pendiente de comprobación`.
4. Solicitar un análisis del expediente y comprobar que la IA no utiliza el
   contenido del archivo pendiente.
5. Marcar el archivo como seguro.
6. Repetir el análisis y comprobar que ahora sí reconoce su contenido.
7. Subir un segundo archivo ficticio y rechazarlo.
8. Comprobar que no se puede descargar ni analizar después del rechazo.
9. Verificar que la subida y la decisión aparecen en `audit_events` con el
   expediente, administrador, fecha, documento y huella correctos.

Resultado exigido: ninguna ruta permite que la IA lea un documento pendiente o
rechazado. La prueba está incompleta si solo se observa la interfaz.

## Prueba obligatoria B: firma electrónica

1. Generar un contrato completamente ficticio.
2. Revisar el PDF antes del envío y confirmar que el sandbox está activo.
3. Enviarlo a firma a una dirección controlada.
4. Completar la firma desde el enlace recibido.
5. Comprobar que el aviso llega al webhook sin credenciales en la URL.
6. Confirmar que el servidor vuelve a consultar la API de Signaturit.
7. Verificar que se archivan el PDF firmado y el documento probatorio, ambos con
   huella SHA-256.
8. Verificar el evento de firma en la cronología y en `audit_events`.
9. Confirmar que el portal del cliente sigue desactivado hasta que Ratio lo
   active expresamente.
10. Repetir el mismo aviso y comprobar que no duplica documentos ni eventos.

Resultado exigido: un aviso recibido no basta para acreditar la firma. El
estado debe proceder de la consulta autenticada al proveedor.

## Prueba obligatoria C: regresión mínima

Ejecutar y conservar el resultado de:

- compilación del CRM;
- pruebas de documentos internos;
- pruebas del asistente de IA;
- pruebas de firma electrónica y firma manual;
- pruebas de seguridad y producción;
- comprobación del acceso real con MFA;
- comprobación de descarga con enlace temporal y caducidad de 60 segundos.

## Criterio de parada

Detener la publicación y no utilizarla con clientes si ocurre cualquiera de
estos hechos:

- la migración no termina sin errores;
- la IA recibe un documento pendiente o rechazado;
- un cliente ve un documento interno o una decisión interna;
- el webhook acepta una petición que no procede de la infraestructura oficial
  del proveedor;
- la firma se registra sin reconsultar la API de Signaturit;
- falta el PDF firmado, el documento probatorio o alguna de sus huellas;
- no queda constancia de una actuación administrativa en la auditoría;
- el acceso administrativo no exige MFA AAL2.

## Vuelta atrás

- No borrar las columnas ni el historial creados por la migración.
- Restaurar las versiones anteriores de las funciones y del CRM desde el
  último commit estable.
- Mantener los documentos nuevos en `pending_review`; no convertirlos
  automáticamente en aceptados.
- Suspender temporalmente los envíos de Signaturit si el proveedor no llega al
  webhook. Investigar primero los encabezados registrados por Supabase.
- No recuperar el secreto en la URL como solución permanente.
- Registrar el incidente, la hora, el alcance y las comprobaciones realizadas.

## Evidencias a conservar

- commit exacto de `main`;
- versión desplegada del CRM y de cada función;
- resultado de todas las pruebas locales;
- capturas sin datos personales de las dos pruebas reales;
- identificadores ficticios de expediente, contrato, archivos y eventos;
- comprobación de `audit_events` y cronología;
- resultado final: aprobado, rechazado o retirado.

La publicación solo se puede declarar apta cuando todas estas evidencias
coincidan. «Código preparado», «función desplegada» y «funcionamiento real
comprobado» son estados distintos.
