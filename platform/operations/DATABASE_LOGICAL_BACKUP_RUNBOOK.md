# Copia lógica de la base de datos de Ratio

Estado: procedimiento y herramienta creados (30/09/2026); el cifrado y el formato del volcado están verificados con un autotest local; falta ejecutar una copia real contra el proyecto Supabase de Ratio y una restauración real en una instancia aislada, con datos ficticios, antes de dar por cerrado el punto 6 del orden de ejecución. Esa ejecución requiere las credenciales reales del proyecto (cadena de conexión Postgres), que no deben usarse ni guardarse fuera del entorno del responsable del proyecto.

Este documento sustituye a la referencia previa del documento maestro, que citaba este archivo sin que existiera todavía en el repositorio.

## Qué protege

Supabase Pro conserva copias automáticas de la base de datos, pero son copias gestionadas por el proveedor, dentro de su propia infraestructura. Este procedimiento añade una copia lógica independiente (`pg_dump --format=custom`), cifrada y guardada fuera de Supabase, para poder reconstruir el esquema `public` (expedientes, documentos, contratos, auditoría) y los metadatos de `storage` en un proyecto distinto si el original queda inaccesible.

La copia usa el mismo estándar que `STORAGE_BACKUP_RUNBOOK.md`:

- AES-256-GCM sobre el volcado completo;
- clave derivada con `scrypt` desde una contraseña de al menos 20 caracteres;
- IV aleatorio y verificación de integridad por SHA-256;
- el volcado en claro nunca toca el disco, solo la versión cifrada.

Herramienta: `platform/operations/db-backup.mjs`. Reutiliza las funciones de cifrado de `storage-backup.mjs` para no mantener dos implementaciones distintas del mismo esquema.

Referencia oficial: [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html) y [Database Backups de Supabase](https://supabase.com/docs/guides/platform/backups).

## Requisitos

- `pg_dump` y `pg_restore` de una versión igual o posterior al servidor de Supabase (PostgreSQL 16 o superior).
- La cadena de conexión directa a Postgres del proyecto (no la URL REST), disponible en el panel de Supabase, en Configuración del proyecto → Base de datos → Connection string. Empieza por `postgresql://` y su host contiene la referencia del proyecto (`bvpeztdfwdbiielaione`).
- Una segunda instancia Postgres, aislada del proyecto de producción, para probar la restauración. Puede ser un proyecto Supabase distinto creado solo para pruebas, o una instancia local temporal. Nunca el mismo proyecto de producción.

## Crear la copia

Abrir una terminal solo durante la operación y definir las variables sin guardarlas en `.env`, scripts, historial compartido ni Git:

```powershell
$env:RATIO_SUPABASE_DB_URL='postgresql://USUARIO:CONTRASEÑA@HOST_DEL_PROYECTO:5432/postgres'
$env:RATIO_BACKUP_PASSPHRASE='CONTRASEÑA_LARGA_Y_EXCLUSIVA'
node platform/operations/db-backup.mjs create --output 'D:\Ratio-Backups-DB'
```

Al terminar, eliminar las variables de la sesión:

```powershell
Remove-Item Env:RATIO_SUPABASE_DB_URL
Remove-Item Env:RATIO_BACKUP_PASSPHRASE
```

## Verificar la copia

La verificación descifra en memoria, comprueba la autenticidad GCM, el tamaño y el hash del volcado, y confirma que el contenido es un volcado `pg_dump --format=custom` válido (lista su tabla de contenidos con `pg_restore --list`) sin restaurar nada:

```powershell
$env:RATIO_BACKUP_PASSPHRASE='CONTRASEÑA_LARGA_Y_EXCLUSIVA'
node platform/operations/db-backup.mjs verify --target 'D:\Ratio-Backups-DB\ratio-db-AAAA-MM-DD...'
Remove-Item Env:RATIO_BACKUP_PASSPHRASE
```

## Restauración aislada (prueba trimestral obligatoria)

La herramienta rechaza explícitamente cualquier intento de restaurar contra el proyecto de producción: si la cadena de conexión de destino contiene la referencia del proyecto real, el comando falla antes de ejecutar nada.

### Forma recomendada: `restore` (descifra y restaura en un solo paso)

El comando `restore` descifra el volcado solo en un archivo temporal dentro de la propia carpeta de la copia, ejecuta `pg_restore` contra la instancia de pruebas y borra ese archivo temporal al terminar, tanto si la restauración funciona como si falla. No hay que manejar el volcado descifrado a mano en ningún momento.

```powershell
$env:RATIO_BACKUP_PASSPHRASE='CONTRASEÑA_LARGA_Y_EXCLUSIVA'
$env:RATIO_RESTORE_TEST_DB_URL='postgresql://USUARIO:CONTRASEÑA@HOST_DE_PRUEBAS:5432/nombre_bd_prueba'
node platform/operations/db-backup.mjs restore --target 'D:\Ratio-Backups-DB\ratio-db-AAAA-MM-DD...'
Remove-Item Env:RATIO_BACKUP_PASSPHRASE
Remove-Item Env:RATIO_RESTORE_TEST_DB_URL
```

### Forma alternativa: `restore-isolated` (cuando ya se tiene un volcado descifrado en disco)

Si el volcado descifrado ya existe como archivo (por ejemplo, extraído para inspección manual), `restore-isolated` lo restaura directamente sin descifrar nada:

```powershell
$env:RATIO_RESTORE_TEST_DB_URL='postgresql://USUARIO:CONTRASEÑA@HOST_DE_PRUEBAS:5432/nombre_bd_prueba'
node platform/operations/db-backup.mjs restore-isolated --dump 'RUTA_AL_DUMP_DESCIFRADO'
Remove-Item Env:RATIO_RESTORE_TEST_DB_URL
```

### Tras la restauración

1. Comprobar en la instancia de pruebas que las tablas de `public` existen, que RLS sigue activo y que el conteo de filas del expediente ficticio coincide con el de origen.
2. Destruir la instancia de pruebas o vaciarla al terminar. No dejar datos, aunque sean ficticios, en una instancia de pruebas abierta indefinidamente.

## Verificación técnica realizada hasta ahora

- Autotest de cifrado/descifrado y detección de manipulación: superado localmente (`node platform/operations/db-backup.mjs self-test`).
- `pg_dump` y `pg_restore` disponibles y con la sintaxis usada por el script confirmada.
- Pendiente: ejecución real de `create`, `verify` y `restore-isolated` contra el proyecto Supabase de Ratio y una instancia aislada, con datos ficticios. Esto requiere que quien tenga las credenciales del proyecto ejecute los tres pasos siguiendo este documento y registre aquí la fecha y el resultado.

## Frecuencia inicial

- Copia manual antes de cualquier migración o cambio estructural relevante.
- Copia automática semanal cuando existan clientes reales, en un horario que no coincida con la copia de almacenamiento.
- Prueba trimestral de restauración en una instancia aislada, nunca sobre producción, en la misma comprobación que la de `STORAGE_BACKUP_RUNBOOK.md`.
- Conservación inicial: 35 días, sujeta a validación jurídica y al protocolo de supresión, igual que la copia de almacenamiento.
