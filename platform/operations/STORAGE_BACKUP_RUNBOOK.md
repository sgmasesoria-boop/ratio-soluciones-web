# Copia cifrada de los documentos de Ratio

Revisión local del 16 de septiembre de 2026: únicamente QA con fixtures ficticios. No se han consultado copias reales, cuentas de nube ni evidencias privadas. Las comprobaciones históricas no acreditan disponibilidad o integridad actual.

## Qué protege

Supabase Pro mantiene copias diarias de la base de datos, pero esas copias contienen los metadatos de Storage y no los archivos físicos. Este procedimiento copia todos los depósitos privados fuera de Supabase sin guardar documentos, rutas, correos ni claves en claro.

La copia usa:

- AES-256-GCM para cada archivo y para el manifiesto;
- una clave derivada con `scrypt` desde una contraseña de al menos 20 caracteres;
- un IV aleatorio por archivo;
- SHA-256 para verificar integridad;
- nombres opacos en el destino; las rutas originales solo existen dentro del manifiesto cifrado.

Referencia oficial: [Database Backups](https://supabase.com/docs/guides/platform/backups) y [Download Objects](https://supabase.com/docs/guides/storage/management/download-objects).

## Destino recomendado

Usar una carpeta externa al proyecto y sincronizada con una cuenta corporativa protegida con MFA. Mantener una segunda copia en otro proveedor o soporte cifrado. No usar el repositorio Git, el escritorio ni una carpeta compartida sin control de acceso.

## Crear la copia

### Asistente gráfico recomendado

Ejecutar `operations/backup-now.ps1`. El asistente solicita de forma oculta la clave `service_role` y la contraseña de cifrado, obliga a elegir dos destinos distintos, crea la copia en el primero, la replica en el segundo y verifica ambos conjuntos antes de confirmar el resultado. Ninguna clave se escribe en disco.

Para una recuperación ante desastre, uno de los destinos debe estar fuera del inmueble y bajo una cuenta corporativa con MFA. Un segundo disco interno protege frente a averías parciales, pero no frente a robo, incendio o destrucción del equipo.

### Ejecución manual

Los siguientes comandos son referencias para operaciones reales autorizadas, no QA.
Definir `$backupDestination`, `$backupSource` y `$restoreDestination` explícitamente
con carpetas externas al proyecto y separadas. No se presupone ninguna unidad.

Abrir PowerShell solo durante la operación y definir las tres variables sin guardarlas en `.env`, scripts, historial compartido ni Git:

```powershell
$env:RATIO_SUPABASE_URL='https://bvpeztdfwdbiielaione.supabase.co'
$env:RATIO_SUPABASE_SERVICE_ROLE_KEY='CLAVE_DE_SERVICIO'
$env:RATIO_BACKUP_PASSPHRASE='CONTRASEÑA_LARGA_Y_EXCLUSIVA'
node operations/storage-backup.mjs create --output $backupDestination
```

Al terminar, eliminar las variables de la sesión:

```powershell
Remove-Item Env:RATIO_SUPABASE_SERVICE_ROLE_KEY
Remove-Item Env:RATIO_BACKUP_PASSPHRASE
Remove-Item Env:RATIO_SUPABASE_URL
```

## Verificar la copia

La verificación descifra en memoria, comprueba la autenticidad GCM, el tamaño y el hash de cada archivo, y no extrae documentos al disco:

```powershell
$env:RATIO_BACKUP_PASSPHRASE='CONTRASEÑA_LARGA_Y_EXCLUSIVA'
node operations/storage-backup.mjs verify --target $backupSource
Remove-Item Env:RATIO_BACKUP_PASSPHRASE
```

## Frecuencia inicial

- Copia automática diaria cuando existan clientes reales.
- Verificación automática de cada copia.
- Conservación inicial: 35 días, sujeta a validación jurídica y al protocolo de supresión.
- Prueba trimestral de restauración en un proyecto o depósito aislado, nunca sobre producción.
- Si se suprime un expediente, registrar también la fecha en la que desaparecerá de las copias por rotación.

## Restauración

No restaurar automáticamente sobre producción. Primero se verifica la copia, se crea un entorno aislado, se revisan permisos y se compara el manifiesto con los metadatos de la base restaurada. La reposición en producción requiere autorización humana, registro de auditoría y comprobación posterior de RLS.

### Prueba aislada mediante asistente

Ejecutar `operations/restore-backup.ps1`. El asistente solicita la carpeta exacta de la copia, una carpeta aislada de destino y la contraseña mediante un campo oculto. Primero verifica íntegramente la copia y después crea una carpeta nueva `ratio-restore-...`; nunca sobrescribe archivos ni se conecta a producción.

Al terminar:

1. Confirmar que `restore-report.json` indica `integrityVerified: true` y `productionModified: false`.
2. Abrir una muestra representativa de archivos restaurados y comprobar su legibilidad.
3. Registrar la fecha, copia utilizada, número de objetos, tamaño y responsable de la prueba, sin anotar nombres de documentos ni la contraseña.
4. Eliminar de forma segura la carpeta restaurada cuando termine la comprobación, salvo que exista una necesidad documentada de conservarla.

La restauración también puede ejecutarse manualmente:

```powershell
$env:RATIO_BACKUP_PASSPHRASE='CONTRASEÑA_LARGA_Y_EXCLUSIVA'
node operations/storage-backup.mjs restore --target $backupSource --output $restoreDestination
Remove-Item Env:RATIO_BACKUP_PASSPHRASE
```


## QA offline

Desde platform: `node storage-backup-qa.mjs`. Todas las peticiones se sustituyen
por mocks y los archivos son ficticios en carpetas temporales. La restauración
verifica antes de crear salida; una extracción fallida limpia solo su carpeta nueva.
Esta QA no prueba credenciales, retención del proveedor ni disponibilidad de copias reales.
