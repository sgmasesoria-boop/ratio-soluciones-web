# Ratio Soluciones — proyecto maestro

Última consolidación: 1 de septiembre de 2026.

Este documento es la fuente única de coordinación del proyecto. No contiene contraseñas, claves, tokens ni datos personales de clientes. Las conversaciones anteriores se conservan como antecedentes, pero las decisiones vigentes y el estado de ejecución deben quedar reflejados aquí.

## 1. Objetivo

Ratio Soluciones capta personas con un problema concreto, estudia su situación, organiza la actuación adecuada y coordina al especialista necesario. La propuesta comercial se apoya en cercanía, capacidad resolutiva, claridad económica y seguimiento ordenado, sin presentarse como una simple intermediación ni como un despacho limitado a una sola profesión.

El sistema debe permitir que una consulta llegue a un expediente único, se valore, se contrate cuando proceda y continúe mediante un CRM interno y un portal privado para el cliente.

## 2. Decisiones vigentes

- Una sola marca y una sola plataforma, con distintas puertas de entrada por problema.
- El expediente existe desde el primer contacto, aunque el acceso del cliente se activa únicamente después de la contratación confirmada.
- Estados generales mínimos: abierto, no contratado y archivado. El resto de la situación se expresa libremente.
- El cliente ve avances, peticiones y documentos dentro de su portal; el CRM mantiene la trazabilidad interna.
- La IA ayuda a ordenar, resumir, detectar carencias, consultar conocimiento y preparar borradores. La decisión y revisión profesional siguen siendo humanas.
- El precio se explica antes de empezar y puede contemplar facilidades de pago o actuación a resultado cuando el servicio lo permita.
- La captación se plantea por situaciones reconocibles, no por profesiones.
- Ratio Empresas no será una asesoría recurrente de nóminas, impuestos o contabilidad. Se estudiarán intervenciones extraordinarias: sociedades desordenadas, cierres registrales, deudas, regularizaciones y proyectos complejos.
- Ada y Dani se conservan como personajes de campañas, no como elementos centrales de la web corporativa.

## 3. Arquitectura consolidada

### Web pública

- Presentación de Ratio y páginas de problemas concretos.
- Formulario sin documentos adjuntos.
- Alta directa de la consulta en el sistema controlado.
- Información legal, privacidad, cookies y condiciones precontractuales.

### CRM privado

- Expediente único desde el contacto inicial.
- Datos de contacto, cronología, notas internas, profesional asignado y peticiones al cliente.
- Un único apartado visible de documentación del expediente. Cada archivo conserva por debajo su protección técnica y muestra claramente si es exclusivo de Ratio o compartido con el cliente.
- Versiones sucesivas de documentos de trabajo.
- Contratos, firma y evidencias.
- Asistencia de IA y biblioteca jurídica privada.
- Auditoría de operaciones y control de accesos.

### Portal privado del cliente

- Acceso únicamente cuando corresponda y mediante autenticación segura.
- Cronología comprensible.
- Peticiones de información o documentos.
- Entrega segura de documentación.
- Avisos y comunicaciones vinculados al expediente.

### Servicios técnicos

- GitHub: código, versiones y respaldo técnico.
- Sites: publicación independiente de web, CRM y portal.
- Supabase europeo: base de datos, autenticación, funciones y almacenamiento privado.
- Signaturit: piloto de firma electrónica; producción pendiente de cierre contractual y técnico.
- SMTP corporativo: correos transaccionales.
- OneDrive y Google Drive: destinos independientes de copias cifradas.

## 4. Estado consolidado

### Implementado o preparado

- Web pública, CRM y portal con compilaciones independientes.
- Expediente único, cronología, documentos, comunicaciones y contratación separada.
- Autenticación, MFA administrativo, RLS y funciones de servidor.
- Dominios corporativos para web, CRM y clientes.
- Sustitución del formulario externo por una entrada pública controlada.
- Copia cifrada de almacenamiento en dos destinos y restauración aislada comprobada.
- Herramientas para copia lógica de base de datos preparadas, todavía sin prueba real superada.
- Inventario, extracción y buscador local inicial de la biblioteca jurídica.
- Piloto de firma electrónica y recepción de eventos en entorno de pruebas.
- Interfaz documental consolidada y verificada localmente: un solo apartado y un solo punto de carga, sin mezclar los permisos privados con los del portal.

### Bloqueos actuales

- La cuenta actual de Codex no tiene acceso como propietaria o editora a los proyectos históricos de Sites del CRM y del portal.
- Deben compartirse esos proyectos desde la cuenta propietaria antes de publicar la interfaz consolidada.
- Falta completar una prueba real de copia y restauración lógica de la base de datos.
- Falta una prueba integral y controlada del recorrido completo de un expediente.
- Falta la validación jurídica final de textos, contratos y encargados del tratamiento.
- El ordenador nuevo está pendiente de instalación y migración controlada.

## 5. Áreas de trabajo

1. **Dirección y negocio**: servicios, precios, colaboradores, rentabilidad y prioridades.
2. **Web y captación**: mensaje, SEO, campañas, landings, Ada y Dani y analítica.
3. **CRM y portal**: operativa diaria, experiencia de usuario, documentos y comunicaciones.
4. **Seguridad y cumplimiento**: accesos, RLS, copias, restauración, privacidad y auditoría.
5. **Biblioteca jurídica e IA**: OCR local, anonimización, búsqueda, recuperación de contexto y borradores revisables.
6. **Infraestructura**: GitHub, Sites, Supabase, correo, dominios, firma y equipos.

## 6. Documentos técnicos canónicos

- `README.md`: alcance general del repositorio.
- `platform/IMPLEMENTATION_STATUS.md`: funciones implementadas y pendientes.
- `platform/operations/PRODUCTION_CLOSEOUT_2026-08-30.md`: última revisión técnica de cierre.
- `platform/SECURITY.md`: controles de seguridad.
- `platform/RETENTION_POLICY.md`: conservación de datos.
- `platform/DATA_ERASURE_PROTOCOL.md`: supresión de datos.
- `platform/operations/STORAGE_BACKUP_RUNBOOK.md`: copia y restauración de almacenamiento.
- `platform/operations/DATABASE_LOGICAL_BACKUP_RUNBOOK.md`: copia lógica de base de datos.
- `platform/operations/PRIVATE_KNOWLEDGE_ASSISTANT.md`: biblioteca privada y asistencia documental.
- `platform/SIGNATURE_INTEGRATION.md`: firma electrónica.

## 7. Orden inmediato de ejecución

1. Instalar y asegurar Windows 11 Pro en el ordenador nuevo.
2. Migrar el proyecto y comprobar las copias sin retirar el ordenador antiguo.
3. Recuperar el acceso de edición a Sites para CRM y portal.
4. Publicar las versiones consolidadas y verificar los dominios corporativos.
5. Ejecutar una prueba integral ficticia con evidencias.
6. Completar copia lógica y restauración aislada de la base de datos.
7. Cerrar la validación legal y de proveedores.
8. Autorizar expresamente el inicio con clientes reales.

## 8. Regla de trabajo

Las nuevas decisiones se registrarán primero en esta tarea principal y después se trasladarán al código o al documento técnico correspondiente. No se continuará el desarrollo de Ratio en conversaciones aisladas. Cuando una tarea especializada termine, su resultado debe resumirse aquí.
