# Evidencia de seguridad y continuidad — 22 de agosto de 2026

## Alcance

Comprobación de solo lectura del proyecto de producción, sus avisos de seguridad, registros recientes y mecanismos de copia. Este documento no contiene claves, contraseñas, contenido de expedientes ni datos personales de clientes.

## Resultado comprobado

- Proyecto activo y saludable, alojado en la región europea `eu-west-1`.
- Organización con plan Supabase Pro.
- Security Advisor: cero avisos de seguridad.
- Registros recientes de autenticación: sin incidencias devueltas en la consulta.
- Registros recientes de base de datos: actividad ordinaria de mantenimiento y despliegues autorizados; no se observó un error persistente.
- Registros recientes de Storage: servicio saludable y migraciones internas completadas.
- Las funciones documentales, de comunicaciones, firma y webhook rechazaron con `401 Unauthorized` las peticiones de prueba que no llevaban una credencial válida.
- La copia cifrada externa de Storage dispone de verificación y restauración aislada probadas de extremo a extremo con datos ficticios.

## Cobertura de copias

- Supabase Pro mantiene copias diarias de la base de datos con siete días de retención.
- Esas copias de base de datos no incluyen el contenido físico de los archivos de Storage.
- Los archivos privados se cubren mediante la copia externa cifrada en dos destinos.
- La restauración preparada nunca escribe en producción: crea una carpeta nueva, comprueba integridad y genera un informe de evidencia.

## Observaciones que no requieren una corrección inmediata

El Performance Advisor informa de varios índices todavía no utilizados. Es esperable en un sistema nuevo con poca actividad. No deben eliminarse antes de disponer de carga real y mediciones representativas, porque varios protegen búsquedas y relaciones que se usarán durante la operativa.

También recomienda que la asignación de conexiones de Auth sea porcentual si en el futuro se amplía el tamaño de cómputo. No constituye una vulnerabilidad ni un fallo actual.

## Pendiente para cerrar continuidad y producción

1. Ejecutar la restauración aislada sobre la copia real del 15 de agosto y conservar `restore-report.json`.
2. Confirmar de nuevo el acceso a los dos destinos externos y establecer la ejecución periódica sin guardar secretos en scripts.
3. Decidir si se añade una exportación lógica independiente de la base de datos. La copia diaria de Supabase protege la operación ordinaria, pero una exportación externa protege mejor frente a la eliminación completa del proyecto o la pérdida de acceso al proveedor.
4. Recuperar o transferir los proyectos Sites para publicar CRM y portal desde la cuenta propietaria.
5. Completar un recorrido real controlado de formulario, contrato, invitación, MFA, portal, solicitud documental, avance y cierre.
6. Formalizar y revisar los contratos de encargado del tratamiento y el registro de proveedores antes de captar expedientes reales.

## Criterio de cierre

Este control acredita el estado técnico observado el 22 de agosto de 2026. No acredita por sí solo la restauración de la copia real, la publicación de la interfaz pendiente ni la aprobación jurídica externa.

