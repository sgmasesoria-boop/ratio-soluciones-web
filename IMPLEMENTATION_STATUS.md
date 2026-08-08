# Estado de implementación

## Completado localmente

- [x] Portal separado de la web pública.
- [x] Diseño de cliente y gestor adaptable a móvil.
- [x] Recorrido del expediente sin fechas automáticas.
- [x] Cronología de actuaciones.
- [x] Siguiente paso del cliente.
- [x] Profesional asignado visible solo dentro del expediente.
- [x] Alta controlada por invitación.
- [x] Avisos y auditoría.
- [x] Esquema PostgreSQL simplificado sin tablas documentales.
- [x] Políticas RLS por expediente.
- [x] Operaciones atómicas para alta y avances.
- [x] Eliminación de subida, descarga y almacenamiento de archivos.
- [x] CRM interno de consultas y oportunidades.
- [x] Embudo comercial con estados y próxima actuación.
- [x] Agenda interna y control de importes presupuestados.
- [x] Conversión de consulta contratada en expediente.
- [x] Migración PostgreSQL, RLS y función segura para operaciones del CRM.
- [x] Escrituras restringidas a funciones Edge; navegador en modo lectura salvo marca de notificaciones.
- [x] Miembros internos ocultos a clientes; teléfono y correo obligatorios conforme a la operativa aprobada.
- [x] CORS separado para portal y CRM y errores internos no expuestos al navegador.

## Pendiente de servicios externos

- [x] Crear proyecto Supabase europeo.
- [x] Aplicar las migraciones de base y verificar permisos y RLS con el cliente ficticio publicado.
- [x] Sustituir FormSubmit por la función pública controlada `public-intake`.
- [x] Implementar MFA TOTP y exigencia AAL2 para administradores y profesionales.
- [x] Documentar la política propuesta de conservación, revisión y borrado.
- [x] Completar revisión técnica previa y lista de validación de privacidad.
- [x] Publicar la interfaz MFA, desplegar las funciones versión 9 y aplicar la migración AAL2.
- [ ] Configurar `ALLOWED_WEB_ORIGINS` con los dominios definitivos de CRM y portal.
- [ ] Configurar SMTP y plantillas de acceso.
- [ ] Activar la protección contra contraseñas filtradas.
- [x] Registrar `clientes.ratiosoluciones.es` y `crm.ratiosoluciones.es` en Sites.
- [ ] Añadir los registros CNAME/TXT en el DNS de IONOS y validar SSL para ambos dominios.
- [ ] Enrolar los factores MFA reales de los administradores.
- [ ] Confirmar la retención efectiva de registros en el plan contratado.
- [ ] Obtener la validación jurídica y de negocio firmada.
- [x] Verificar en Supabase que el cliente ficticio solo ve su expediente, no ve CRM ni puede escribir; que AAL1 bloquea al administrador y AAL2 lo habilita.
- [ ] Completar el recorrido de invitación y recuperación por correo cuando el SMTP propio esté activo.
- [ ] Alta de clientes reales únicamente después de superar las pruebas.
