param(
  [string]$BackupRoot,
  [string]$RestoreRoot
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Show-SecretPrompt {
  $form = New-Object Windows.Forms.Form
  $form.Text = 'Contraseña de la copia cifrada'
  $form.StartPosition = 'CenterScreen'
  $form.Size = New-Object Drawing.Size(560,210)
  $form.TopMost = $true
  $form.FormBorderStyle = 'FixedDialog'
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false
  $label = New-Object Windows.Forms.Label
  $label.Text = 'Introduce la contraseña exclusiva de la copia. Solo se utilizará en memoria.'
  $label.Location = New-Object Drawing.Point(20,18)
  $label.Size = New-Object Drawing.Size(505,48)
  $form.Controls.Add($label)
  $input = New-Object Windows.Forms.TextBox
  $input.Location = New-Object Drawing.Point(20,75)
  $input.Size = New-Object Drawing.Size(505,28)
  $input.UseSystemPasswordChar = $true
  $form.Controls.Add($input)
  $ok = New-Object Windows.Forms.Button
  $ok.Text = 'Restaurar'
  $ok.Location = New-Object Drawing.Point(340,120)
  $ok.DialogResult = [Windows.Forms.DialogResult]::OK
  $form.Controls.Add($ok)
  $cancel = New-Object Windows.Forms.Button
  $cancel.Text = 'Cancelar'
  $cancel.Location = New-Object Drawing.Point(440,120)
  $cancel.DialogResult = [Windows.Forms.DialogResult]::Cancel
  $form.Controls.Add($cancel)
  $form.AcceptButton = $ok
  $form.CancelButton = $cancel
  $form.Add_Shown({$input.Focus()})
  if($form.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){throw 'OPERACION_CANCELADA'}
  return $input.Text
}

function Select-Folder([string]$Description,[string]$InitialPath){
  $dialog = New-Object Windows.Forms.FolderBrowserDialog
  $dialog.Description = $Description
  $dialog.ShowNewFolderButton = $true
  if(Test-Path -LiteralPath $InitialPath){$dialog.SelectedPath = $InitialPath}
  if($dialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){throw 'OPERACION_CANCELADA'}
  return [IO.Path]::GetFullPath($dialog.SelectedPath)
}

$warning = @'
Esta prueba recuperará la copia en una carpeta nueva y aislada.

No conectará con Supabase, no modificará producción y no sobrescribirá archivos.
Al finalizar debes revisar el informe y eliminar de forma segura la restauración de prueba.
'@

if([Windows.Forms.MessageBox]::Show($warning,'Restauración controlada de Ratio',[Windows.Forms.MessageBoxButtons]::OKCancel,[Windows.Forms.MessageBoxIcon]::Warning) -ne [Windows.Forms.DialogResult]::OK){exit 0}

if([string]::IsNullOrWhiteSpace($BackupRoot)){
  $BackupRoot = Select-Folder 'Selecciona la carpeta exacta ratio-storage-... que contiene backup.json y manifest.enc.' 'C:\'
}else{
  $BackupRoot = [IO.Path]::GetFullPath($BackupRoot)
}
if([string]::IsNullOrWhiteSpace($RestoreRoot)){
  $RestoreRoot = Select-Folder 'Selecciona una carpeta aislada. El asistente creará dentro una carpeta ratio-restore-... nueva.' 'C:\'
}else{
  $RestoreRoot = [IO.Path]::GetFullPath($RestoreRoot)
  if(!(Test-Path -LiteralPath $RestoreRoot)){
    New-Item -ItemType Directory -Path $RestoreRoot -Force | Out-Null
  }
}
if(!(Test-Path -LiteralPath (Join-Path $BackupRoot 'backup.json')) -or !(Test-Path -LiteralPath (Join-Path $BackupRoot 'manifest.enc'))){
  throw 'LA_CARPETA_DE_COPIA_NO_ES_VALIDA'
}
$passphrase = Show-SecretPrompt
if($passphrase.Length -lt 20){throw 'LA_CONTRASENA_DE_COPIA_ES_DEMASIADO_CORTA'}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupScript = Join-Path $scriptRoot 'storage-backup.mjs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
if(!(Test-Path -LiteralPath $node)){
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if(!$nodeCommand){throw 'NODE_NO_DISPONIBLE'}
  $node = $nodeCommand.Source
}

try{
  $env:RATIO_BACKUP_PASSPHRASE = $passphrase
  $verifiedJson = & $node $backupScript verify --target $backupRoot
  if($LASTEXITCODE -ne 0){throw 'LA_COPIA_NO_HA_SUPERADO_LA_VERIFICACION'}
  $restoredJson = & $node $backupScript restore --target $backupRoot --output $restoreRoot
  if($LASTEXITCODE -ne 0){throw 'FALLO_EN_LA_RESTAURACION_CONTROLADA'}
  $restored = ($restoredJson -join [Environment]::NewLine) | ConvertFrom-Json
  [Windows.Forms.MessageBox]::Show("Restauración aislada completada.`n`nArchivos: $($restored.objectCount)`nTamaño: $($restored.totalBytes) bytes`nCarpeta: $($restored.target)`n`nProducción no se ha modificado.",'Restauración comprobada',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
}catch{
  [Windows.Forms.MessageBox]::Show("La restauración se ha detenido.`n`n$($_.Exception.Message)",'Restauración no completada',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  throw
}finally{
  Remove-Item Env:RATIO_BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
  $passphrase = $null
}
