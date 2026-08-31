param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("protect", "unprotect")]
    [string]$Operation
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

$inputStream = [Console]::OpenStandardInput()
$memory = New-Object IO.MemoryStream
$inputStream.CopyTo($memory)
$source = $memory.ToArray()
$entropy = [Text.Encoding]::UTF8.GetBytes("RatioSoluciones|OCR|v1")

try {
    if ($Operation -eq "protect") {
        $result = [Security.Cryptography.ProtectedData]::Protect(
            $source,
            $entropy,
            [Security.Cryptography.DataProtectionScope]::CurrentUser
        )
    }
    else {
        $result = [Security.Cryptography.ProtectedData]::Unprotect(
            $source,
            $entropy,
            [Security.Cryptography.DataProtectionScope]::CurrentUser
        )
    }
    $outputStream = [Console]::OpenStandardOutput()
    $outputStream.Write($result, 0, $result.Length)
    $outputStream.Flush()
}
finally {
    [Array]::Clear($source, 0, $source.Length)
    if ($null -ne $result) { [Array]::Clear($result, 0, $result.Length) }
    $memory.Dispose()
}

