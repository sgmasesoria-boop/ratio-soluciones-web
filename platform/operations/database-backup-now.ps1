param([string]$PrimaryRoot,[string]$SecondaryRoot)

$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Show-SecretPrompt {
  param([string]$Title,[string]$Message)
  $form=New-Object Windows.Forms.Form
  $form.Text=$Title; $form.StartPosition='CenterScreen'; $form.Size=New-Object Drawing.Size(590,220)
  $form.TopMost=$true; $form.FormBorderStyle='FixedDialog'; $form.MaximizeBox=$false; $form.MinimizeBox=$false
  $label=New-Object Windows.Forms.Label
  $label.Text=$Message; $label.Location=New-Object Drawing.Point(20,18); $label.Size=New-Object Drawing.Size(540,55); $form.Controls.Add($label)
  $secretBox=New-Object Windows.Forms.TextBox
  $secretBox.Location=New-Object Drawing.Point(20,82); $secretBox.Size=New-Object Drawing.Size(540,28); $secretBox.UseSystemPasswordChar=$true; $form.Controls.Add($secretBox)
  $ok=New-Object Windows.Forms.Button
  $ok.Text='Continuar'; $ok.Location=New-Object Drawing.Point(370,130); $ok.DialogResult=[Windows.Forms.DialogResult]::OK; $form.Controls.Add($ok)
  $cancel=New-Object Windows.Forms.Button
  $cancel.Text='Cancelar'; $cancel.Location=New-Object Drawing.Point(470,130); $cancel.DialogResult=[Windows.Forms.DialogResult]::Cancel; $form.Controls.Add($cancel)
  $form.AcceptButton=$ok; $form.CancelButton=$cancel; $form.ActiveControl=$secretBox
  $dialogResult=$form.ShowDialog()
  $secretValue=$secretBox.Text
  $form.Dispose()
  if($dialogResult -ne [Windows.Forms.DialogResult]::OK){return $null}
  return $secretValue
}

function Select-Folder {
  param([string]$Description,[string]$InitialPath)
  $dialog=New-Object Windows.Forms.FolderBrowserDialog
  $dialog.Description=$Description; $dialog.ShowNewFolderButton=$true
  if(Test-Path -LiteralPath $InitialPath){$dialog.SelectedPath=$InitialPath}
  if($dialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){throw 'OPERACION_CANCELADA'}
  return [IO.Path]::GetFullPath($dialog.SelectedPath)
}

if([Windows.Forms.MessageBox]::Show(@'
Esta operación exportará la estructura y los datos de Ratio, los cifrará y copiará en dos destinos.

La contraseña de la base y la contraseña de copia solo se mantendrán en memoria. Los archivos SQL sin cifrar se crearán en una carpeta temporal y se eliminarán antes de finalizar.
'@,'Copia lógica cifrada de Ratio',[Windows.Forms.MessageBoxButtons]::OKCancel,[Windows.Forms.MessageBoxIcon]::Warning) -ne [Windows.Forms.DialogResult]::OK){exit 0}

$defaultCloud=if($env:OneDrive){$env:OneDrive}else{'C:\'}
if([string]::IsNullOrWhiteSpace($PrimaryRoot)){$PrimaryRoot=Select-Folder 'DESTINO 1: selecciona Ratio-Backups-Cifrados en OneDrive.' $defaultCloud}else{$PrimaryRoot=[IO.Path]::GetFullPath($PrimaryRoot)}
if([string]::IsNullOrWhiteSpace($SecondaryRoot)){$SecondaryRoot=Select-Folder 'DESTINO 2: selecciona Ratio-Backups-Cifrados en Google Drive.' 'C:\'}else{$SecondaryRoot=[IO.Path]::GetFullPath($SecondaryRoot)}
if($PrimaryRoot.TrimEnd('\') -ieq $SecondaryRoot.TrimEnd('\')){throw 'LOS_DESTINOS_DEBEN_SER_DIFERENTES'}
if($SecondaryRoot.StartsWith($PrimaryRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or $PrimaryRoot.StartsWith($SecondaryRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'UN_DESTINO_NO_PUEDE_ESTAR_DENTRO_DEL_OTRO'}

$databasePassword=$null
while([string]::IsNullOrWhiteSpace($databasePassword)){
  $databasePassword=Show-SecretPrompt 'Paso 1 de 3 · Contraseña de Supabase' 'Introduce la contraseña automática de Database de Supabase. Aquí no se exige una longitud mínima.'
  if($null -eq $databasePassword){
    [Windows.Forms.MessageBox]::Show('Operación cancelada. No se ha conectado con Supabase ni se ha creado ningún archivo.','Copia cancelada',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    exit 0
  }
  if([string]::IsNullOrWhiteSpace($databasePassword)){
    [Windows.Forms.MessageBox]::Show('La contraseña de Database no puede estar vacía. Vuelve a intentarlo.','Contraseña necesaria',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
  }
}

$passphrase=$null
$confirmation=$null
while($true){
  $passphrase=Show-SecretPrompt 'Paso 2 de 3 · Contraseña privada de las copias' 'Introduce la contraseña privada que protege tus copias cifradas. Se recomienda que sea distinta de la de Supabase. Debe contener 12 caracteres o más.'
  if($null -eq $passphrase){
    [Windows.Forms.MessageBox]::Show('Operación cancelada. No se ha conectado con Supabase ni se ha creado ningún archivo.','Copia cancelada',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    exit 0
  }
  if($passphrase.Length -lt 12){
    [Windows.Forms.MessageBox]::Show('La contraseña de la copia debe contener al menos 12 caracteres. No se ha iniciado ninguna copia.','Contraseña demasiado corta',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
    continue
  }
  $confirmation=Show-SecretPrompt 'Paso 3 de 3 · Confirmar contraseña de las copias' 'Repite la contraseña privada de las copias. No introduzcas aquí la contraseña de Supabase.'
  if($null -eq $confirmation){
    [Windows.Forms.MessageBox]::Show('Operación cancelada. No se ha conectado con Supabase ni se ha creado ningún archivo.','Copia cancelada',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
    exit 0
  }
  if($passphrase -cne $confirmation){
    [Windows.Forms.MessageBox]::Show('Las dos contraseñas de la copia no coinciden. Vuelve a introducirlas.','Contraseñas diferentes',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
    continue
  }
  break
}

$pgRoot='C:\Program Files\PostgreSQL\17\bin'
$psql=Join-Path $pgRoot 'psql.exe'; $pgDump=Join-Path $pgRoot 'pg_dump.exe'
if(!(Test-Path -LiteralPath $psql) -or !(Test-Path -LiteralPath $pgDump)){throw 'HERRAMIENTAS_POSTGRESQL_17_NO_DISPONIBLES'}
$scriptRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$packScript=Join-Path $scriptRoot 'database-backup.mjs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
if(!(Test-Path -LiteralPath $node)){throw 'NODE_NO_DISPONIBLE'}

$tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')+'\'
$tempRoot=[IO.Path]::GetFullPath((Join-Path $tempBase ('ratio-db-export-'+[guid]::NewGuid().ToString('N'))))
if(!$tempRoot.StartsWith($tempBase,[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($tempRoot) -notmatch '^ratio-db-export-[0-9a-f]{32}$'){throw 'RUTA_TEMPORAL_NO_SEGURA'}
New-Item -ItemType Directory -Path $tempRoot | Out-Null
$temporaryRemoved=$false

try{
  $env:PGPASSWORD=$databasePassword
  $hostFound=$null; $connection=$null
  $passwordRejected=$false; $networkBlocked=$false; $tenantRejected=$false
  foreach($candidate in @('aws-1-eu-west-1.pooler.supabase.com')){
    $candidateConnection="host=$candidate port=5432 dbname=postgres user=postgres.bvpeztdfwdbiielaione sslmode=require connect_timeout=12"
    $previousErrorPreference=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    $probe=& $psql $candidateConnection -X -w -Atqc 'select current_database()' 2>&1
    $probeExitCode=$LASTEXITCODE
    $ErrorActionPreference=$previousErrorPreference
    $probeText=(($probe | ForEach-Object {$_.ToString()}) -join ' ')
    if($probeExitCode -eq 0 -and (($probe | ForEach-Object {$_.ToString()}) -join '').Trim() -eq 'postgres'){$hostFound=$candidate; $connection=$candidateConnection; break}
    if($probeText -match 'password authentication failed|autenticaci[oó]n.*contrase'){ $passwordRejected=$true }
    if($probeText -match 'Permission denied|No connection could be made|timeout expired|Connection timed out'){ $networkBlocked=$true }
    if($probeText -match 'Tenant or user not found'){ $tenantRejected=$true }
  }
  if(!$hostFound){
    if($passwordRejected){throw 'CONTRASENA_DATABASE_RECHAZADA'}
    if($networkBlocked){throw 'CONEXION_A_SUPABASE_BLOQUEADA_POR_RED'}
    if($tenantRejected){throw 'SERVIDOR_POOLER_NO_IDENTIFICADO_ABRE_CONNECT_EN_SUPABASE'}
    throw 'NO_SE_PUDO_CONECTAR_CON_LA_BASE'}

  $schema=Join-Path $tempRoot 'schema.sql'; $data=Join-Path $tempRoot 'data.sql'
  $migrationSchema=Join-Path $tempRoot 'migrations-schema.sql'; $migrationData=Join-Path $tempRoot 'migrations-data.sql'

  & $pgDump $connection --file=$schema --schema=public --schema-only --no-owner --no-subscriptions --quote-all-identifiers
  if($LASTEXITCODE -ne 0){throw 'FALLO_EXPORTANDO_ESTRUCTURA'}
  & $pgDump $connection --file=$data --schema=public --data-only --no-owner --no-privileges --no-subscriptions --quote-all-identifiers
  if($LASTEXITCODE -ne 0){throw 'FALLO_EXPORTANDO_DATOS'}
  & $pgDump $connection --file=$migrationSchema --schema=supabase_migrations --schema-only --no-owner --no-subscriptions --quote-all-identifiers
  if($LASTEXITCODE -ne 0){throw 'FALLO_EXPORTANDO_HISTORIAL_ESTRUCTURA'}
  & $pgDump $connection --file=$migrationData --schema=supabase_migrations --data-only --no-owner --no-privileges --no-subscriptions --quote-all-identifiers
  if($LASTEXITCODE -ne 0){throw 'FALLO_EXPORTANDO_HISTORIAL_DATOS'}

  $metadata=[ordered]@{projectRef='bvpeztdfwdbiielaione';createdAt=[DateTime]::UtcNow.ToString('o');postgresClient=((& $pgDump --version) -join ' ');scope=@('public','supabase_migrations')} | ConvertTo-Json
  Set-Content -LiteralPath (Join-Path $tempRoot 'metadata.json') -Value $metadata -Encoding UTF8

  foreach($name in @('schema.sql','data.sql','migrations-schema.sql','migrations-data.sql','metadata.json')){if((Get-Item -LiteralPath (Join-Path $tempRoot $name)).Length -le 0){throw "ARCHIVO_EXPORTADO_VACIO_$name"}}

  $env:RATIO_BACKUP_PASSPHRASE=$passphrase
  $packedJson=& $node $packScript pack --source $tempRoot --output $PrimaryRoot
  if($LASTEXITCODE -ne 0){throw 'FALLO_AL_CIFRAR_LA_BASE'}
  $packed=($packedJson -join [Environment]::NewLine) | ConvertFrom-Json
  $verify1Json=& $node $packScript verify --target $packed.target
  if($LASTEXITCODE -ne 0){throw 'FALLO_AL_VERIFICAR_PRIMER_DESTINO'}
  $verify1=($verify1Json -join [Environment]::NewLine) | ConvertFrom-Json

  $secondaryTarget=Join-Path $SecondaryRoot ([IO.Path]::GetFileName($packed.target))
  if(Test-Path -LiteralPath $secondaryTarget){throw 'LA_SEGUNDA_COPIA_YA_EXISTE'}
  Copy-Item -LiteralPath $packed.target -Destination $secondaryTarget -Recurse
  $verify2Json=& $node $packScript verify --target $secondaryTarget
  if($LASTEXITCODE -ne 0){throw 'FALLO_AL_VERIFICAR_SEGUNDO_DESTINO'}
  $verify2=($verify2Json -join [Environment]::NewLine) | ConvertFrom-Json

  Remove-Item -LiteralPath $tempRoot -Recurse -Force
  $temporaryRemoved=!(Test-Path -LiteralPath $tempRoot)
  if(!$temporaryRemoved){throw 'NO_SE_PUDO_ELIMINAR_LA_EXPORTACION_SIN_CIFRAR'}

  [Windows.Forms.MessageBox]::Show("Copia de base terminada y verificada en dos destinos.`n`nArchivos cifrados: $($verify1.fileCount)`nDatos exportados: $($verify1.totalBytes) bytes`nTemporales sin cifrar eliminados: sí",'Copia de base completada',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
}catch{
  [Windows.Forms.MessageBox]::Show("No se ha completado la copia de la base.`n`n$($_.Exception.Message)",'Copia detenida',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  throw
}finally{
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:RATIO_BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
  $databasePassword=$null; $passphrase=$null; $confirmation=$null
  if(!$temporaryRemoved -and (Test-Path -LiteralPath $tempRoot)){
    try{Remove-Item -LiteralPath $tempRoot -Recurse -Force}catch{[Windows.Forms.MessageBox]::Show("ATENCIÓN: no se pudo eliminar la carpeta temporal sensible:`n$tempRoot",'Limpieza pendiente',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error) | Out-Null}
  }
}
