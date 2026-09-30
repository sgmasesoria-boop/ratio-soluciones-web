# Estado de implementación

## Completado localmente

- [x] Canal trazable para solicitar aclaraciones o llamadas y responder desde Ratio.
- [x] Coordinación de comunicaciones sin publicar teléfonos o correos personales del profesional.
- [x] Portal separado de la web pública.
- [x] Diseño de cliente y gestor adaptable a móvil.
- [x] Expediente único desde el primer contacto, sin conversión intermedia.
- [x] Situación del expediente escrita libremente, sin fases premarcadas.
- [x] Cronología de actuaciones.
- [x] Siguiente paso del cliente.
- [x] Profesional asignado visible solo dentro del expediente.
- [x] Alta controlada por invitación.
- [x] Avisos y auditoría.
- [x] Esquema PostgreSQL con solicitudes, documentos y trazabilidad de accesos.
- [x] Políticas RLS por expediente.
- [x] Operaciones atómicas para alta y avances.
- [x] Subida privada de PDF/JPG/PNG, descarga temporal y revisión administrativa.
- [x] CRM interno unificado en expedientes.
- [x] Estado general reducido a abierto, no contratado o archivado; contratación separada.
- [x] Agenda interna y control de importes presupuestados.
- [x] Activación separada del portal únicamente tras confirmar la contratación.
- [x] Documentos de trabajo con etiquetas libres y versiones sucesivas no destructivas.
- [x] Formulario contractual interno con identidad, causa, precio y alcance manual.
- [x] Anotación contractual libre, sin lista de estados ni transiciones prefijadas.
- [x] Modelo de contrato separado con plantilla versionada y exigencia de PDF firmado más expediente de evidencias.
- [x] Registro inmutable y sin estados prefijados para los eventos del proveedor de firma.
- [x] Bloqueo en base de datos que impide activar el portal sin firma y evidencias verificables.
- [x] Generación local del PDF contractual, huella SHA-256 y archivo privado.
- [x] Integración piloto con Signaturit sandbox, verificación independiente del webhook y archivo del documento probatorio.
- [x] Migración PostgreSQL, RLS y función segura para operaciones del CRM.
- [x] Escrituras restringidas a funciones Edge; navegador en modo lectura salvo marca de notificaciones.
- [x] Miembros internos ocultos a clientes; teléfono y correo obligatorios conforme a la operativa aprobada.
- [x] CORS separado para portal y CRM y errores internos no expuestos al navegador.
- [x] Control de acceso de funciones Edge alineado con RLS: contrato confirmado,
  portal habilitado y expediente abierto para documentos y comunicaciones del cliente.

## Pendiente de servicios externos

- [x] Aplicar la migración y desplegar `case-communications`.

- [x] Crear proyecto Supabase europeo.
- [x] Aplicar las migraciones de base y verificar permisos y RLS con el cliente ficticio publicado.
- [x] Sustituir FormSubmit por la función pública controlada `public-intake`.
- [x] Implementar MFA TOTP y exigencia AAL2 para administradores y profesionales.
- [x] Documentar la política propuesta de conservación, revisión y borrado.
- [x] Completar revisión técnica previa y lista de validación de privacidad.
- [x] Publicar la interfaz MFA, desplegar las funciones versión 9 y aplicar la migración AAL2.
- [x] Configurar `ALLOWED_WEB_ORIGINS` con los dominios definitivos de CRM y portal; los orígenes provisionales quedan bloqueados.
- [x] Configurar SMTP y plantillas de acceso.
- [x] Activar la protección contra contraseñas filtradas en Supabase Pro, contraseña robusta de 12 caracteres y MFA interno.
- [x] Registrar `clientes.ratiosoluciones.es` y `crm.ratiosoluciones.es` en Sites.
- [x] Añadir los registros CNAME/TXT en el DNS de Arsys y validar SSL para ambos dominios.
- [x] Enrolar y verificar el factor MFA real del administrador inicial.
- [ ] Confirmar la retención efectiva de registros en el plan contratado.
- [ ] Obtener la validación jurídica y de negocio firmada.
- [x] Verificar en Supabase que el cliente ficticio solo ve su expediente, no ve CRM ni puede escribir; que AAL1 bloquea al administrador y AAL2 lo habilita.
- [x] Completar el recorrido de invitación y recuperación por correo con el SMTP propio y el dominio corporativo.
- [ ] Alta de clientes reales únicamente después de superar las pruebas.
- [ ] Aplicar y verificar en producción la migración de expediente único y documentos versionados.
- [ ] Validar jurídicamente `CONTRACT_TEMPLATE_V1.md` y confirmar los datos fiscales y domicilio exactos.
- [ ] Contratar el acceso API de producción de Signaturit y configurar sus secretos después de validar jurídicamente la plantilla.
- [ ] Desplegar las funciones Edge con el control de acceso contractual reforzado y
  repetir una prueba autenticada de documento y comunicación con portal deshabilitado.
- [ ] Aplicar una migración específica que revoque permisos heredados de ejecución
  en funciones auxiliares privadas y añada denegación RLS explícita a las tres tablas internas de IA.

