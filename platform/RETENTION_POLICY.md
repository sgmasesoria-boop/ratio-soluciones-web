# Política operativa de conservación y borrado

Versión de trabajo para validación jurídica antes de incorporar clientes reales. Esta política aplica el principio de minimización: conservar solo lo necesario, durante el tiempo justificado y con acceso restringido.

## Plazos propuestos

| Información | Plazo operativo | Acción al finalizar |
| --- | --- | --- |
| Registros de autenticación y seguridad | 90 días | Eliminación o anonimización, salvo incidente abierto o obligación documentada. |
| Auditoría de operaciones internas | 24 meses | Revisión y eliminación segura, salvo que sea necesaria para una reclamación, investigación o bloqueo legal. |
| Consultas no contratadas | 12 meses desde el cierre | Eliminación o anonimización de datos personales y notas libres. |
| Expedientes y clientes activos | Mientras exista la relación | Revisión semestral de necesidad y exactitud. |
| Expedientes cerrados | El plazo legal que Ratio documente para cada servicio | Bloqueo de acceso ordinario y eliminación al terminar el plazo aplicable. |
| Copias de seguridad | Según el ciclo técnico aprobado, con un máximo inicial de 35 días | Expiración automática y prueba trimestral de restauración. |

Los plazos jurídicos de expedientes cerrados dependen del servicio prestado y deben quedar validados por el asesor jurídico de Ratio. No se asignará un plazo genérico sin identificar la finalidad, base jurídica y posibles responsabilidades.

## Controles

- Revisión mensual de usuarios internos, factores MFA, accesos fallidos y eventos anómalos.
- Revisión semestral de consultas cerradas, expedientes, cuentas inactivas y datos del CRM.
- La copia de base de datos y la copia de archivos de Storage se controlan por separado. Cada copia de archivos debe quedar cifrada, verificada y almacenada fuera de Supabase conforme a `operations/STORAGE_BACKUP_RUNBOOK.md`.
- La supresión de un expediente debe alcanzar la copia operativa y quedar vinculada a la fecha de expiración de las copias históricas; una restauración posterior obliga a repetir la supresión antes de reabrir el servicio.
- Borrado mediante una operación administrativa trazable; nunca mediante acceso directo del navegador a tablas.
- Los registros de auditoría son de solo inserción para la aplicación. Su depuración requiere una tarea administrativa separada y autorizada.
- Cualquier excepción debe indicar responsable, motivo, fecha de revisión y fecha prevista de eliminación.
- Los datos sujetos a una reclamación o investigación se bloquean: no se usan en la operativa ordinaria y no se eliminan hasta cerrar la causa que justificó el bloqueo.

## Incidentes y brechas

Todo incidente se registra, aunque no llegue a notificarse. Si una brecha puede suponer riesgo para las personas, el responsable evalúa y, cuando corresponda, notifica a la autoridad de control sin dilación indebida y dentro del plazo legal de 72 horas. Si el riesgo es alto, también se evalúa la comunicación a las personas afectadas.

## Responsables de revisión

- Responsable operativo: revisa accesos, cuentas y expedientes.
- Responsable técnico: revisa registros, copias, restauración y eliminación segura.
- Asesoría jurídica o DPD, si procede: valida bases jurídicas, plazos, encargados, transferencias y excepciones.
