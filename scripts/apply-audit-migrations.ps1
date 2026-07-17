# =============================================================================
# Aplica os 4 patches SQL de remediação no projeto Supabase remoto
# via Management API (Access Token sbp_…).
#
# Uso:
#   $env:SUPABASE_ACCESS_TOKEN = "sbp_...."
#   .\scripts\apply-audit-migrations.ps1
#
# Ou:
#   .\scripts\apply-audit-migrations.ps1 -AccessToken "sbp_...."
# =============================================================================
param(
  [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN,
  [string]$ProjectRef = "maoduppsngdwupokxtqr"
)

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $PSScriptRoot "..\supabase\migration_rls_authenticated_only.sql"))) {
  $root = Resolve-Path (Join-Path $PSScriptRoot "..")
} else {
  $root = Resolve-Path (Join-Path $PSScriptRoot "..")
}

if (-not $AccessToken) {
  $AccessToken = [Environment]::GetEnvironmentVariable("SUPABASE_ACCESS_TOKEN", "User")
}
if (-not $AccessToken) {
  Write-Error "Defina SUPABASE_ACCESS_TOKEN (sbp_...) ou passe -AccessToken"
}

$migrations = @(
  "migration_rls_authenticated_only.sql",
  "migration_gerar_escala_lock_patch1.sql",
  "migration_produtividade_idempotent.sql",
  "migration_field_events_and_roles.sql"
)

$api = "https://api.supabase.com/v1/projects/$ProjectRef/database/query"
$headers = @{
  "Authorization" = "Bearer $AccessToken"
  "Content-Type"  = "application/json"
  "Accept"        = "application/json"
}

function Invoke-SupabaseSql([string]$sql, [string]$label) {
  Write-Host ""
  Write-Host "=== $label ===" -ForegroundColor Cyan
  $body = @{ query = $sql } | ConvertTo-Json -Compress -Depth 5
  try {
    $resp = Invoke-RestMethod -Method Post -Uri $api -Headers $headers -Body $body -TimeoutSec 120
    Write-Host "OK: $label" -ForegroundColor Green
    if ($resp) {
      $preview = ($resp | ConvertTo-Json -Compress -Depth 3)
      if ($preview.Length -gt 300) { $preview = $preview.Substring(0, 300) + "..." }
      Write-Host $preview
    }
    return $true
  } catch {
    $err = $_.ErrorDetails.Message
    if (-not $err) { $err = $_.Exception.Message }
    Write-Host "FAIL: $label" -ForegroundColor Red
    Write-Host $err
    return $false
  }
}

# Sanity
if (-not (Invoke-SupabaseSql "SELECT 1 AS ok;" "connectivity")) {
  Write-Error "Falha de autenticação/conectividade. Verifique o Access Token e o project ref."
}

$allOk = $true
foreach ($file in $migrations) {
  $path = Join-Path $root "supabase\$file"
  if (-not (Test-Path $path)) {
    Write-Host "MISSING: $path" -ForegroundColor Red
    $allOk = $false
    continue
  }
  $sql = Get-Content -Path $path -Raw -Encoding UTF8
  if (-not (Invoke-SupabaseSql $sql $file)) {
    $allOk = $false
    Write-Host "Parando após falha em $file (corrija e reexecute)." -ForegroundColor Yellow
    break
  }
}

# Verificações pós-apply
$verify = @"
SELECT
  (SELECT count(*) FROM pg_policies WHERE tablename = 'clientes' AND roles::text LIKE '%authenticated%') AS pol_clientes_auth,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'clientes' AND roles::text LIKE '%public%') AS pol_clientes_public,
  EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'uq_produtividade_colab_data_ref') AS idx_prod_idem,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='field_events') AS has_field_events,
  EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='app_profiles') AS has_app_profiles,
  EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gerar_escala') AS has_gerar_escala;
"@

Invoke-SupabaseSql $verify "post-apply verification" | Out-Null

if ($allOk) {
  Write-Host ""
  Write-Host "Todas as migrations foram aplicadas." -ForegroundColor Green
  exit 0
} else {
  Write-Host ""
  Write-Host "Concluído com erros." -ForegroundColor Red
  exit 1
}
