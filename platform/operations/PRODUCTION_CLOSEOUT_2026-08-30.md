# Cierre de producción de Ratio — límite 30 de agosto de 2026

Última actualización: 21 de agosto de 2026.

## Completado y comprobado

- Cambios documentales, firma y seguridad fusionados en `main` mediante PR #23.
- Funciones activas: `document-workflow` v21, `case-communications` v15, `contract-signature` v19 y `signaturit-webhook` v16.
- Acceso del cliente condicionado a expediente abierto, contrato confirmado y portal habilitado.
- Permisos internos endurecidos y políticas restrictivas explícitas en las tres tablas privadas de IA.
- Supabase Security Advisor sin alertas.
- 26 controles locales y de producción aprobados sin fallos.
- Cabeceras de seguridad activas en web, CRM y portal: HSTS, CSP, bloqueo de marcos, `nosniff`, política de referencia y permisos de cámara, micrófono y ubicación desactivados.
- Copia cifrada real del 15 de agosto verificada entonces en OneDrive y Google Drive.

## Bloqueos que requieren intervención externa

- La cuenta empresarial actual de Codex no tiene acceso a los proyectos Sites históricos de web pública, CRM y portal. Sites devuelve `project_not_found` y no lista proyectos. Los tres dominios funcionan, pero CRM y portal sirven una interfaz anterior sin el nuevo control documental.
- Debe recuperarse o transferirse la propiedad de los tres proyectos Sites antes de publicar la interfaz fusionada y la actualización legal.

## Pendiente antes de producción completa

- Publicar CRM y portal desde la cuenta propietaria y verificar contenido con consulta sin caché.
- Ejecutar un recorrido real controlado: formulario, alta, contrato, invitación, MFA administrativo, portal, solicitud, documento, avance y cierre.
- Realizar una restauración controlada de la copia cifrada en un destino aislado.
- Confirmar acceso actual al segundo destino de Google Drive y definir ejecución diaria sin guardar secretos en scripts.
- Revisar la información legal final y los contratos con proveedores que tratan datos.
- Repetir Security Advisor, los 26 controles y la prueba pública inmediatamente antes del lanzamiento.

