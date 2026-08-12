# Protocolo de supresión, bloqueo y limpieza de datos

Versión 1.0 — 12 de agosto de 2026.

Este protocolo evita que una limpieza técnica se convierta en una pérdida accidental o en un incumplimiento. Se aplica a consultas, expedientes, documentos, cuentas cliente, notificaciones, análisis de IA y registros relacionados.

## 1. Clasificar la petición antes de tocar datos

El responsable debe elegir y documentar uno de estos supuestos:

1. **Reinicio de pruebas:** solo contiene datos ficticios o pruebas expresamente identificadas. Puede realizarse borrado definitivo de la copia activa.
2. **Petición de una persona:** verificar identidad, alcance y fundamento. No ejecutar un borrado automático sin revisar obligaciones de conservación y posibles reclamaciones.
3. **Fin de un expediente:** aplicar el plazo aprobado para ese tipo de servicio. Mientras exista una obligación o posible responsabilidad, bloquear el acceso ordinario en lugar de destruir.
4. **Dato incorporado por error:** aislarlo de inmediato y decidir si procede borrarlo, bloquearlo o tratarlo como incidente.
5. **Incidente de seguridad:** conservar las evidencias estrictamente necesarias y activar el procedimiento de brechas antes de alterar registros.

La supresión de datos personales no siempre significa destrucción inmediata. Cuando sea aplicable el artículo 32 de la LOPDGDD, los datos se bloquearán: quedarán reservados, sin uso ni visualización ordinaria, hasta que termine el plazo de posibles responsabilidades; después se destruirán.

## 2. Autorización mínima

Toda operación debe tener un identificador interno y dejar constancia de:

- quién la solicita y con qué autoridad;
- tipo de operación: borrar, bloquear, anonimizar o corregir;
- personas, consultas y expedientes afectados;
- motivo y base de la decisión;
- fecha, ejecutor y revisor;
- excepciones o retenciones aplicables.

En producción se exige revisión por dos personas para borrados masivos. El ejecutor no debe aprobar su propia operación. Nunca se aceptan órdenes genéricas como «borrar antiguos» sin una relación cerrada de identificadores y recuentos.

## 3. Comprobaciones previas

Antes de ejecutar:

1. Detener temporalmente altas y modificaciones del alcance afectado.
2. Obtener recuentos por tabla y por contenedor, sin exportar contenido personal al registro técnico.
3. Confirmar que no existe expediente activo, reclamación, investigación, obligación fiscal o requerimiento que exija conservación.
4. Identificar documentos físicos, base de datos, autenticación, correos, proveedores, análisis de IA, copias y exportaciones.
5. Verificar que permanece al menos una cuenta administradora activa y que el borrado no afecta a configuración, migraciones, SMTP, dominios ni claves.
6. Fijar una condición de parada: si el inventario real no coincide exactamente con el autorizado, no se borra nada.
7. Para datos reales, valorar una copia bloqueada solo cuando sea jurídicamente necesaria. Un borrado solicitado no se «protege» creando otra copia innecesaria.

## 4. Orden técnico de ejecución

1. Revocar o inutilizar el acceso de las cuentas afectadas.
2. Eliminar los archivos con la API de Storage; nunca borrar únicamente las filas de `storage.objects`, porque dejaría archivos huérfanos.
3. Eliminar primero relaciones hijas: accesos a documentos, análisis de IA, documentos, solicitudes, notificaciones, cronología, miembros, tareas y notas.
4. Eliminar después consultas y expedientes.
5. Eliminar las cuentas de autenticación cliente y comprobar la eliminación en `profiles`.
6. Depurar registros auxiliares que contengan datos personales. Conservar solo una evidencia mínima de la operación, sin nombres, correos, teléfonos, documentos ni textos del caso.
7. Desactivar o retirar inmediatamente cualquier función temporal de borrado.

La evidencia mínima contendrá únicamente: identificador de operación, fecha, autorización, recuentos por tipo, resultado, incidencias y versión de este protocolo.

## 5. Verificación obligatoria

La operación no se considera terminada hasta comprobar:

- recuento cero del alcance autorizado en consultas, expedientes y tablas relacionadas;
- recuento cero de sus archivos en Storage;
- inexistencia de cuentas cliente afectadas;
- permanencia y acceso de la cuenta administradora;
- ausencia de datos personales en el registro técnico del borrado;
- funcionamiento de CRM, portal y formulario sin crear nuevas pruebas;
- registro de cualquier fallo parcial y su corrección.

Un borrado parcial se trata como incidente operativo: se detiene, se conserva el inventario técnico sin datos personales y se completa o revierte solo después de una nueva revisión.

## 6. Copias de seguridad y proveedores

La eliminación en producción afecta a la copia activa, pero puede no retirar inmediatamente datos ya incluidos en copias automáticas, registros técnicos o sistemas de encargados. Ratio debe documentar para cada proveedor:

- ubicación y plazo de conservación;
- posibilidad de borrado selectivo;
- fecha prevista de expiración de la copia;
- medidas que impiden restaurar el dato suprimido a la operativa;
- procedimiento para repetir la supresión si una restauración fuese imprescindible.

No se reutiliza una copia anterior sin aplicar de nuevo todas las supresiones registradas desde la fecha de esa copia.

## 7. Prohibiciones

- No borrar directamente desde el navegador ni desde una consola compartida.
- No ejecutar SQL improvisado sobre Storage.
- No incluir datos personales en tickets, capturas, commits o mensajes de error.
- No conservar exportaciones «por si acaso».
- No borrar auditoría necesaria para acreditar una reclamación o un incidente.
- No automatizar la destrucción de expedientes reales hasta que los plazos jurídicos por servicio estén aprobados.

## 8. Revisión

El protocolo se revisará antes de incorporar clientes reales, al cambiar de proveedor o política de copias, después de un incidente y, como mínimo, una vez al año. La política de plazos se mantiene en `RETENTION_POLICY.md`; este documento define la ejecución segura, no sustituye la validación jurídica de cada plazo.
