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

## Pendiente de servicios externos

- [ ] Crear proyecto Supabase europeo.
- [ ] Aplicar migraciones y probar RLS con cuentas ficticias.
- [ ] Configurar SMTP y plantillas de acceso.
- [ ] Configurar `clientes.ratiosoluciones.es`.
- [ ] Activar MFA de administradores.
- [ ] Revisión técnica y legal previa a producción.
- [ ] Alta de clientes reales únicamente después de superar las pruebas.
