# Revisión técnica y de privacidad previa a producción

Fecha de revisión técnica: 9 de agosto de 2026.

Esta revisión no sustituye el criterio de un abogado ni constituye validación jurídica definitiva. Identifica controles comprobables y decisiones que Ratio debe aprobar antes de utilizar datos reales.

## Resultado técnico

- La web pública envía las consultas a la función `public-intake` de Supabase. El código vigente no usa FormSubmit.
- El portal no permite subir, descargar ni almacenar documentos.
- El acceso es por invitación; no existe registro público.
- Las tablas operativas aplican RLS y el navegador autenticado solo tiene lectura, salvo la marca de lectura de notificaciones.
- Las escrituras privilegiadas pasan por funciones Edge con validación de usuario y función.
- Las operaciones internas exigen nivel de autenticación `aal2`; el cliente puede acceder a su propio expediente con su sesión ordinaria.
- La interfaz obliga a configurar o verificar TOTP antes de abrir una sesión interna.
- Los orígenes web de portal y CRM están separados.
- Las pruebas automatizadas cubren cliente, administrador, CRM, portal, API, RLS y MFA. Debe repetirse una prueba integral contra el entorno publicado antes del primer cliente real.

## Decisiones pendientes de activación externa

- Configurar un SMTP propio y verificar entrega, recuperación e invitaciones.
- Activar la protección contra contraseñas filtradas en Supabase Auth.
- Validar los dominios `clientes.ratiosoluciones.es` y `crm.ratiosoluciones.es` en DNS.
- Enrolar al menos dos factores MFA administrativos y conservar códigos de recuperación fuera del navegador.
- Confirmar que la retención efectiva de registros coincide con `RETENTION_POLICY.md` y con las posibilidades del plan contratado.

## Validación de privacidad necesaria

- Completar el Registro de Actividades de Tratamiento con finalidad, categorías de datos, personas, destinatarios, transferencias, plazos y medidas de seguridad.
- Documentar base jurídica y deber de información para consulta inicial, seguimiento comercial y prestación del servicio.
- Firmar y conservar los contratos de encargo con Supabase y con los proveedores de correo, alojamiento y soporte que accedan a datos personales.
- Revisar localización, subencargados y transferencias internacionales de cada proveedor.
- Aprobar un procedimiento para derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad.
- Aprobar análisis de riesgos y procedimiento de brechas; valorar una evaluación de impacto si cambian las categorías de datos, el volumen o el uso previsto.
- Limitar las notas libres: no registrar datos de salud, menores, cuentas bancarias, documentación o datos de terceros salvo necesidad, base jurídica y canal expresamente aprobados.

## Criterio de salida

No se incorporará ningún cliente real hasta que los controles externos anteriores estén activos, la prueba integral haya resultado satisfactoria y una persona responsable haya firmado la validación técnica y jurídica.

| Aprobación | Persona | Fecha | Resultado |
| --- | --- | --- | --- |
| Técnica | Pendiente | Pendiente | Pendiente |
| Privacidad/jurídica | Pendiente | Pendiente | Pendiente |
| Responsable de negocio | Pendiente | Pendiente | Pendiente |

