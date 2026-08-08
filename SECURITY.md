# Seguridad del portal simplificado

Este documento define requisitos de producción. Que un control aparezca aquí no significa que esté activo: el estado verificable se mantiene en `IMPLEMENTATION_STATUS.md`.

## Identidad y acceso

- Alta solo por invitación.
- Confirmación de correo obligatoria.
- MFA obligatorio para administradores y profesionales.
- Sesiones limitadas y revocables.
- Acceso por expediente y mínimo privilegio.

## Minimización

- El portal no acepta ni almacena archivos.
- Solo conserva datos identificativos, estado, avances, responsable y avisos.
- Las notificaciones externas no incluyen detalles sensibles.
- Los textos de cronología deben evitar datos innecesarios de salud, menores, cuentas o terceros.

## Auditoría y continuidad

- Las altas y los cambios sensibles quedan registrados en la auditoría interna.
- Los accesos y fallos de autenticación deberán conservarse mediante los registros de Supabase con una retención aprobada antes de producción.
- La auditoría es append-only.
- Copia diaria de la base de datos.
- Prueba trimestral de restauración.
- Procedimiento documentado de incidentes y revocación de accesos.

## Privacidad

- Registro de actividades de tratamiento.
- Análisis de riesgos antes de producción.
- Contratos con proveedores y colaboradores.
- Política de conservación y eliminación.
- Procedimiento de ejercicio de derechos.
- Contrato de encargo y verificación de transferencias para cada proveedor.
- Revisión semestral de la necesidad y conservación de los datos del CRM.
