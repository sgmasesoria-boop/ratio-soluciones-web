# Cierre de producción de Ratio — límite 30 de agosto de 2026

Última actualización: 24 de agosto de 2026.

## Completado y comprobado

- Cambios documentales, firma y seguridad fusionados en `main` mediante PR #23.
- Funciones activas: `document-workflow` v21, `case-communications` v15, `contract-signature` v19 y `signaturit-webhook` v16.
- Acceso del cliente condicionado a expediente abierto, contrato confirmado y portal habilitado.
- Permisos internos endurecidos y políticas restrictivas explícitas en las tres tablas privadas de IA.
- Supabase Security Advisor sin alertas.
- Revisión de seguridad, rendimiento y registros del 22 de agosto documentada en `SECURITY_SNAPSHOT_2026-08-22.md`, sin indicios de un incidente activo.
- 26 controles locales y de producción aprobados sin fallos.
- Cabeceras de seguridad activas en web, CRM y portal: HSTS, CSP, bloqueo de marcos, `nosniff`, política de referencia y permisos de cámara, micrófono y ubicación desactivados.
- Copia cifrada real renovada el 24 de agosto y verificada en OneDrive y Google Drive: 35 objetos, 18.999.230 bytes y 38 archivos técnicos idénticos en ambos destinos según SHA-256.
- Restauración real aislada completada el 24 de agosto: 35 objetos recuperados, 18.999.230 bytes, integridad verificada, todos los archivos no vacíos y legibles, y producción no modificada. Evidencia sanitizada en `RESTORE_TEST_EVIDENCE_2026-08-24.json`.
- Segunda consulta en vivo a Supabase del 24 de agosto: proyecto `ACTIVE_HEALTHY` y Security Advisor sin avisos. Los avisos de rendimiento son únicamente informativos y no justifican eliminar índices en un sistema todavía sin carga representativa.

## Bloqueos que requieren intervención externa

- La cuenta empresarial actual de Codex no tiene acceso a los proyectos Sites históricos de web pública, CRM y portal. Sites devuelve `project_not_found` y no lista proyectos. Los tres dominios funcionan, pero CRM y portal sirven una interfaz anterior sin el nuevo control documental.
- Debe recuperarse o transferirse la propiedad de los tres proyectos Sites antes de publicar la interfaz fusionada y la actualización legal.

## Pendiente antes de producción completa

- Publicar CRM y portal desde la cuenta propietaria y verificar contenido con consulta sin caché.
- Ejecutar un recorrido real controlado: formulario, alta, contrato, invitación, MFA administrativo, portal, solicitud, documento, avance y cierre.
- Definir la ejecución periódica de las copias sin guardar claves ni contraseñas en scripts y repetir una restauración controlada según el calendario del protocolo.
- Ejecutar y restaurar en un entorno aislado la copia lógica externa de la base de datos descrita en `DATABASE_LOGICAL_BACKUP_RUNBOOK.md`. El protocolo está definido, pero no debe marcarse como completado hasta disponer de herramientas PostgreSQL/Supabase compatibles y una prueba real.
- Revisar la información legal final y los contratos con proveedores que tratan datos.
- Repetir Security Advisor, los 26 controles y la prueba pública inmediatamente antes del lanzamiento.

