# Ratio Soluciones · CRM y plataforma privada

Portal separado de la web pública para que cada cliente consulte el estado real de su expediente. Esta versión no admite, almacena ni descarga documentos.

La zona interna incorpora un CRM operativo para registrar cada consulta, controlar el seguimiento y convertir una contratación en expediente sin duplicar datos.

## Funciones incluidas

- Alta únicamente por invitación después de aceptar el estudio inicial.
- Confirmación de correo, contraseña y recuperación de acceso.
- Vista de cliente y gestión interna.
- Estado del expediente mediante seis etapas, sin fechas estimadas.
- Cronología de actuaciones ya realizadas.
- Indicación clara de lo que necesita hacer el cliente.
- Identidad, profesión y acreditación del profesional una vez asignado.
- Avisos vinculados a cada avance.
- Registro de auditoría para las operaciones administrativas.
- Permisos por expediente mediante RLS.
- Embudo de consultas desde la entrada hasta la contratación o cierre.
- Registro de origen, consentimiento, provincia, categoría y próxima actuación.
- Agenda interna de tareas, importes presupuestados y control económico inicial.
- Conversión controlada de una consulta en expediente e invitación al cliente.

## Exclusiones deliberadas

- No existe registro público.
- No se aceptan archivos.
- No hay almacenamiento documental.
- No se envían detalles sensibles en las notificaciones externas.
- La identidad de los profesionales no se publica en la web; aparece en el expediente después de su asignación.

## Arquitectura prevista

- `clientes.ratiosoluciones.es`: aplicación privada.
- Supabase Auth: invitación, confirmación, recuperación y sesiones.
- PostgreSQL: consultas, tareas, perfiles, expedientes, miembros, avances, avisos y auditoría.
- Edge Functions: alta controlada y actualización atómica del expediente.
- SMTP propio: mensajes de acceso y avisos genéricos.

## Pruebas

```powershell
npm run build
npm run test:ui
npm run test:api
npm run test:production
```

El modo de demostración utiliza únicamente datos ficticios guardados en `localStorage`.

## Pasos externos antes de producción

1. Crear un proyecto Supabase en región europea.
2. Aplicar las migraciones en orden.
3. Crear el primer perfil administrador de forma controlada.
4. Configurar SMTP, dominio y URL de redirección.
5. Desplegar `invite-client`, `update-case` y `manage-crm`.
6. Activar MFA para administradores.
7. Ejecutar las pruebas con cuentas ficticias reales.
8. Revisar privacidad, contratos y texto legal antes del primer cliente.
