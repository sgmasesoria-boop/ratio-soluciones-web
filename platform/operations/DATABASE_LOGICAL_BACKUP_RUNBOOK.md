# Copia lógica independiente de la base de datos

Última revisión: 24 de agosto de 2026.

## Objetivo

Mantener fuera de Supabase una exportación cifrada de la estructura, los roles personalizados y los datos de negocio de Ratio. Esta copia complementa, pero no sustituye, las copias diarias de Supabase Pro ni la copia externa de los archivos de Storage.

La finalidad es poder reconstruir el sistema si se elimina por completo el proyecto o se pierde el acceso al proveedor. Una restauración ordinaria dentro de los siete días debe utilizar primero las copias administradas de Supabase.

## Estado comprobado

- Supabase Pro conserva copias diarias de la base durante siete días.
- Esas copias no incluyen el contenido físico de Storage.
- Storage ya dispone de copia cifrada en dos destinos y de una restauración real aislada comprobada.
- La exportación lógica externa de la base de datos todavía no se ha ejecutado.
- El ordenador no tiene instalado actualmente Supabase CLI, Docker ni las utilidades PostgreSQL `pg_dump` y `psql`.

## Método oficial seleccionado

Se utilizará Supabase CLI con la conexión `Session pooler`, que Supabase recomienda por defecto. La herramienta genera tres archivos separados:

1. `roles.sql`: roles personalizados.
2. `schema.sql`: estructura gestionada por la aplicación.
3. `data.sql`: datos, usando `COPY` y excluyendo las tablas vectoriales de Storage indicadas por Supabase.

Comandos oficiales de referencia:

```text
supabase db dump --db-url [CONNECTION_STRING] -f roles.sql --role-only
supabase db dump --db-url [CONNECTION_STRING] -f schema.sql
supabase db dump --db-url [CONNECTION_STRING] -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
```

No se ejecutarán pegando la contraseña en este repositorio, en un archivo `.cmd`, en GitHub ni en una conversación. La conexión se introducirá localmente mediante un control oculto y solo permanecerá en memoria durante la operación.

## Requisitos pendientes

1. Instalar una herramienta oficial compatible:
   - opción preferida: Supabase CLI fijada como dependencia del proyecto y Docker Desktop; o
   - alternativa: cliente PostgreSQL compatible, si se reproduce y valida el comportamiento de exclusión de esquemas gestionados.
2. Obtener desde `Connect` la cadena `Session pooler` y la contraseña de la base de datos.
3. Ejecutar la exportación en una carpeta temporal fuera de las carpetas sincronizadas.
4. Comprobar que los tres archivos existen, no están vacíos y no contienen errores de `pg_dump`.
5. Cifrar el conjunto con AES-256-GCM y una contraseña exclusiva de al menos 20 caracteres.
6. Copiar el paquete cifrado a dos destinos independientes y verificar tamaño y SHA-256.
7. Eliminar de forma segura la carpeta temporal sin cifrar.

## Restauración de prueba

La primera restauración nunca se realizará sobre producción. Debe usarse un proyecto Supabase separado o un PostgreSQL local aislado y seguir este orden:

1. restaurar `roles.sql`;
2. restaurar `schema.sql`;
3. desactivar temporalmente los disparadores según el procedimiento oficial;
4. restaurar `data.sql` dentro de una única transacción y detenerse ante el primer error;
5. reactivar las publicaciones Realtime necesarias;
6. verificar recuentos por tabla, relaciones, RLS y acceso por perfiles;
7. destruir el entorno de prueba cuando se haya conservado la evidencia sanitizada.

Las contraseñas de roles personalizados no se recuperan desde las copias administradas y deberán restablecerse. Los cambios propios realizados en los esquemas gestionados `auth` o `storage`, si existen, deben tratarse de forma separada conforme al procedimiento oficial.

## Frecuencia propuesta

- exportación lógica cifrada: semanal y antes de cualquier migración importante;
- copia externa de Storage: semanal y antes de operaciones masivas;
- restauración controlada completa: trimestral;
- revisión de las copias diarias de Supabase: mensual y antes de una puesta en producción.

## Criterio de cierre

Esta medida solo se marcará como completada cuando exista una exportación real cifrada en dos destinos, se hayan comparado sus huellas SHA-256 y una restauración aislada haya terminado sin modificar producción. Disponer del guion o de las herramientas no constituye una copia válida.

