# Copia lógica independiente de la base de datos

Última revisión: 24 de agosto de 2026.

## Objetivo

Mantener fuera de Supabase una exportación cifrada de la estructura, los roles personalizados y los datos de negocio de Ratio. Esta copia complementa, pero no sustituye, las copias diarias de Supabase Pro ni la copia externa de los archivos de Storage.

La finalidad es poder reconstruir el sistema si se elimina por completo el proyecto o se pierde el acceso al proveedor. Una restauración ordinaria dentro de los siete días debe utilizar primero las copias administradas de Supabase.

## Estado comprobado

- Supabase Pro conserva copias diarias de la base durante siete días.
- Esas copias no incluyen el contenido físico de Storage.
- Storage ya dispone de copia cifrada en dos destinos y de una restauración real aislada comprobada.
- PostgreSQL Command Line Tools 17.11 está instalado y se han comprobado `pg_dump`, `psql` y `pg_restore`.
- El asistente local cifra con AES-256-GCM, verifica integridad, permite restaurar en una carpeta aislada y elimina los SQL temporales. Supera 10 de 10 controles con datos ficticios, incluida la detección de contraseña errónea y manipulación.
- La conexión de red y el servidor Session pooler se alcanzaron desde la ejecución local; Supabase rechazó la contraseña Database utilizada. No se exportó ningún dato ni quedó un archivo temporal.
- La exportación lógica externa real de la base todavía no se ha ejecutado. Requiere restablecer la contraseña Database y repetir el asistente.

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

1. Restablecer desde `Database > Settings` la contraseña Database y conservarla en el gestor de contraseñas, nunca en el repositorio.
2. Ejecutar el asistente local. Este identifica el Session pooler europeo sin guardar la dirección ni la contraseña.
3. Exportar en una carpeta temporal fuera de las carpetas sincronizadas los esquemas `public` y `supabase_migrations`, separados en estructura y datos.
4. Comprobar que los cinco archivos esperados existen, no están vacíos y no contienen errores de `pg_dump`.
5. Cifrar el conjunto con AES-256-GCM y una contraseña exclusiva de al menos 20 caracteres.
6. Copiar el paquete cifrado a OneDrive y Google Drive, y verificar contenido y huellas criptográficas en ambos destinos.
7. Eliminar la carpeta temporal sin cifrar antes de presentar la operación como completada.

No existen roles PostgreSQL personalizados de Ratio. Las cuentas Auth, sus contraseñas cifradas y la clave raíz del proyecto se recuperan mediante la restauración física de Supabase Pro a otro proyecto. La exportación externa se centra en las tablas, funciones, políticas, relaciones y datos de negocio propios de Ratio; no debe presentarse como sustituto de la copia física administrada.

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
