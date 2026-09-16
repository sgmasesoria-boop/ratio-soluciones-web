param(
  [string]$PrimaryRoot,
  [string]$SecondaryRoot
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Show-SecretPrompt {
  param([string]$Title,[string]$Message)
  $form = New-Object Windows.Forms.Form
  $form.Text = $Title
  $form.StartPosition = 'CenterScreen'
  $form.Size = New-Object Drawing.Size(560,210)
  $form.TopMost = $true
  $form.FormBorderStyle = 'FixedDialog'
  $form.MaximizeBox = $false
  $form.MinimizeBox = $false

  $label = New-Object Windows.Forms.Label
  $label.Text = $Message
  $label.Location = New-Object Drawing.Point(20,18)
  $label.Size = New-Object Drawing.Size(505,48)
  $form.Controls.Add($label)

  $input = New-Object Windows.Forms.TextBox
  $input.Location = New-Object Drawing.Point(20,75)
  $input.Size = New-Object Drawing.Size(505,28)
  $input.UseSystemPasswordChar = $true
  $form.Controls.Add($input)

  $ok = New-Object Windows.Forms.Button
  $ok.Text = 'Continuar'
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

function Select-BackupFolder {
  param([string]$Description,[string]$InitialPath)
  $dialog = New-Object Windows.Forms.FolderBrowserDialog
  $dialog.Description = $Description
  $dialog.ShowNewFolderButton = $true
  if(Test-Path -LiteralPath $InitialPath){$dialog.SelectedPath = $InitialPath}
  if($dialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK){throw 'OPERACION_CANCELADA'}
  return [IO.Path]::GetFullPath($dialog.SelectedPath)
}

$warning = @'
Esta operación copiará todos los documentos privados de Ratio ya cifrados.

Necesitas:
1. Una Secret key del proyecto Supabase (`sb_secret_...`) o, si aún está activa, la antigua `service_role`.
2. Una contraseña de copia de al menos 20 caracteres, distinta a la del CRM.
3. Dos destinos diferentes. Recomendado: nube corporativa con MFA + disco externo.

Si pierdes la contraseña de copia, los archivos no podrán recuperarse.
'@

if([Windows.Forms.MessageBox]::Show($warning,'Copia de seguridad de emergencia',[Windows.Forms.MessageBoxButtons]::OKCancel,[Windows.Forms.MessageBoxIcon]::Warning) -ne [Windows.Forms.DialogResult]::OK){exit 0}

$defaultCloud = if($env:OneDrive){$env:OneDrive}else{([IO.Path]::GetPathRoot([Environment]::GetFolderPath('UserProfile')))}
if([string]::IsNullOrWhiteSpace($PrimaryRoot)){
  $PrimaryRoot = Select-BackupFolder 'DESTINO 1: selecciona una carpeta de nube corporativa protegida con MFA.' $defaultCloud
}else{
  $PrimaryRoot = [IO.Path]::GetFullPath($PrimaryRoot)
  if(!(Test-Path -LiteralPath $PrimaryRoot)){New-Item -ItemType Directory -Path $PrimaryRoot -Force | Out-Null}
}
if([string]::IsNullOrWhiteSpace($SecondaryRoot)){
  $SecondaryRoot = Select-BackupFolder 'DESTINO 2: selecciona un disco externo o una segunda nube independiente.' ([IO.Path]::GetPathRoot([Environment]::GetFolderPath('UserProfile')))
}else{
  $SecondaryRoot = [IO.Path]::GetFullPath($SecondaryRoot)
  if(!(Test-Path -LiteralPath $SecondaryRoot)){New-Item -ItemType Directory -Path $SecondaryRoot -Force | Out-Null}
}

if($primaryRoot.TrimEnd('\') -ieq $secondaryRoot.TrimEnd('\')){throw 'LOS_DESTINOS_DEBEN_SER_DIFERENTES'}
if($secondaryRoot.StartsWith($primaryRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or $primaryRoot.StartsWith($secondaryRoot.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'UN_DESTINO_NO_PUEDE_ESTAR_DENTRO_DEL_OTRO'}

$serviceKey = Show-SecretPrompt 'Clave secreta de Supabase' 'Pega una Secret key con formato sb_secret_... o la antigua service_role. Se usará solo en memoria y no se guardará.'
$passphrase = Show-SecretPrompt 'Contraseña de la copia' 'Introduce una contraseña exclusiva de 20 caracteres o más. Guárdala fuera del ordenador.'
$confirmation = Show-SecretPrompt 'Confirmar contraseña' 'Vuelve a introducir la contraseña de la copia.'

if($passphrase.Length -lt 20){throw 'LA_CONTRASENA_DE_COPIA_ES_DEMASIADO_CORTA'}
if($passphrase -cne $confirmation){throw 'LAS_CONTRASENAS_NO_COINCIDEN'}
if($serviceKey.Length -lt 40){throw 'LA_CLAVE_SECRETA_DE_SUPABASE_NO_PARECE_VALIDA'}

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupScript = Join-Path $scriptRoot 'storage-backup.mjs'
$node = (Get-Command node.exe -ErrorAction Stop).Source
if(!(Test-Path -LiteralPath $node)){
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if(!$nodeCommand){throw 'NODE_NO_DISPONIBLE'}
  $node = $nodeCommand.Source
}

try{
  $env:RATIO_SUPABASE_URL = 'https://bvpeztdfwdbiielaione.supabase.co'
  $env:RATIO_SUPABASE_SERVICE_ROLE_KEY = $serviceKey
  $env:RATIO_BACKUP_PASSPHRASE = $passphrase

  $createdJson = & $node $backupScript create --output $primaryRoot
  if($LASTEXITCODE -ne 0){throw 'FALLO_AL_CREAR_LA_COPIA'}
  $created = ($createdJson -join [Environment]::NewLine) | ConvertFrom-Json
  $verifiedPrimaryJson = & $node $backupScript verify --target $created.target
  if($LASTEXITCODE -ne 0){throw 'FALLO_AL_VERIFICAR_LA_PRIMERA_COPIA'}
  $verifiedPrimary = ($verifiedPrimaryJson -join [Environment]::NewLine) | ConvertFrom-Json

  $secondaryTarget = Join-Path $secondaryRoot ([IO.Path]::GetFileName($created.target))
  if(Test-Path -LiteralPath $secondaryTarget){throw 'LA_SEGUNDA_COPIA_YA_EXISTE'}
  Copy-Item -LiteralPath $created.target -Destination $secondaryTarget -Recurse
  $verifiedSecondaryJson = & $node $backupScript verify --target $secondaryTarget
  if($LASTEXITCODE -ne 0){throw 'FALLO_AL_VERIFICAR_LA_SEGUNDA_COPIA'}
  $verifiedSecondary = ($verifiedSecondaryJson -join [Environment]::NewLine) | ConvertFrom-Json

  $receipt = [ordered]@{
    verified_at = [DateTime]::UtcNow.ToString('o')
    project_ref = 'bvpeztdfwdbiielaione'
    primary = $created.target
    secondary = $secondaryTarget
    object_count = $verifiedPrimary.objectCount
    total_bytes = $verifiedPrimary.totalBytes
    primary_verified = $verifiedPrimary.verified
    secondary_verified = $verifiedSecondary.verified
  } | ConvertTo-Json
  Set-Content -LiteralPath (Join-Path $created.target 'verification.json') -Value $receipt -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $secondaryTarget 'verification.json') -Value $receipt -Encoding UTF8

  [Windows.Forms.MessageBox]::Show("Copia terminada y verificada en dos destinos.`n`nArchivos: $($verifiedPrimary.objectCount)`nTamaño: $($verifiedPrimary.totalBytes) bytes`n`nGuarda la contraseña fuera del ordenador.",'Copia completada',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Information) | Out-Null
}catch{
  [Windows.Forms.MessageBox]::Show("No se ha completado la copia.`n`n$($_.Exception.Message)",'Copia detenida',[Windows.Forms.MessageBoxButtons]::OK,[Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  throw
}finally{
  Remove-Item Env:RATIO_SUPABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:RATIO_SUPABASE_SERVICE_ROLE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:RATIO_BACKUP_PASSPHRASE -ErrorAction SilentlyContinue
  $serviceKey = $null
  $passphrase = $null
  $confirmation = $null
}
