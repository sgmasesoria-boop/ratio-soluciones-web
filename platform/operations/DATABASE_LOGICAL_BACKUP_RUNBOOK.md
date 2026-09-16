# Copia lógica independiente de la base de datos

Revisión local: 2026-09-16. Este documento describe el código conservado; no
acredita que existan copias reales actuales ni clientes PostgreSQL instalados.
No se han consultado servicios ni evidencias privadas en esta revisión.

## Alcance real del asistente

`database-backup-now.ps1` solicita confirmación, dos destinos separados y las
contraseñas mediante campos ocultos. Resuelve psql.exe y pg_dump.exe desde
RATIO_POSTGRES_BIN, PATH o ProgramFiles/PostgreSQL/17/bin. El proyecto esperado y
el Session pooler están fijados para impedir apuntar por accidente a otra base.
Su ejecución conecta un servicio real y requiere autorización independiente.

Exporta exactamente cinco archivos temporales:

- schema.sql: estructura del esquema public.
- data.sql: datos del esquema public.
- migrations-schema.sql: estructura de supabase_migrations.
- migrations-data.sql: datos de supabase_migrations.
- metadata.json: metadatos técnicos de la exportación.

No exporta roles.sql, usuarios Auth ni archivos físicos de Storage. No debe
presentarse como copia completa de todo el proyecto Supabase. Las políticas de
retención o recuperación del proveedor deben comprobarse por separado.

## Cifrado y destinos

`database-backup.mjs pack` exige los cinco archivos y el proyecto esperado,
cifra con AES-256-GCM y scrypt y crea un directorio nuevo fuera del repositorio.
La implementación exige al menos 12 caracteres de contraseña; se recomienda
usar 20 o más y guardarla en un gestor seguro. No se guarda en el repositorio.
El asistente copia el paquete a un segundo destino que debe estar separado y
no existir previamente, verifica ambos y elimina los SQL temporales.

No invocar el asistente durante QA. Tampoco introducir valores reales en
comandos, logs, ejemplos, archivos .env o conversaciones.

## Verificación y extracción aislada

`verify` descifra en memoria y comprueba autenticidad, hashes, nombres, tamaños
y totales. `restore` verifica primero y extrae en una carpeta nueva, fuera del
repositorio y sin solaparse con la copia de origen. Rechaza sobrescrituras;
si la extracción falla elimina únicamente la carpeta que acaba de crear.
No importa SQL en PostgreSQL ni modifica Supabase.

La importación real requiere un procedimiento adicional revisado para la versión
y extensiones del destino, comprobación de permisos/RLS y autorización explícita.
No ejecutar SQL ni borrar entornos basándose únicamente en este runbook.

## QA segura

Desde platform: `node database-backup-qa.mjs`.
Usa SQL ficticio en carpetas temporales y verifica cifrado, recuperación exacta,
contraseña insuficiente o errónea, manipulación, aislamiento y ausencia de residuos
ante fallos. No necesita PostgreSQL ni credenciales; no prueba una restauración SQL.

## Operaciones pendientes

Provisionar clientes PostgreSQL compatibles, validar credenciales y destinos,
autorizar la exportación real, verificar las dos copias y probar recuperación en
un entorno separado. No dar por existentes las copias de otro ordenador ni
restablecer contraseñas como parte de una comprobación local.
