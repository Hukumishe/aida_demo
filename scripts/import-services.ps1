<#
.SYNOPSIS
    Массовый импорт категорий и услуг в AIDA через REST API.

.DESCRIPTION
    Читает scripts/services-catalog.json и создаёт недостающие категории, затем
    добавляет все услуги. Уже существующие (по имени + аудитории) пропускаются,
    чтобы скрипт можно было безопасно запускать повторно.

.PARAMETER ApiUrl
    Базовый URL API, напр. https://api.example.com или http://localhost:3000

.PARAMETER Token
    Bearer JWT владельца / админа / девелопера.

.PARAMETER OrganizationId
    (Необязательно) ID организации — нужен только если токен DEVELOPER.

.PARAMETER CatalogPath
    Путь к JSON-файлу с категориями и услугами. По умолчанию — рядом со скриптом.

.EXAMPLE
    ./import-services.ps1 -ApiUrl "https://api.aida.kz" -Token "eyJhbGciOi..."

.EXAMPLE
    ./import-services.ps1 -ApiUrl "https://api.aida.kz" -Token "..." -OrganizationId "org_abc123def45"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$OrganizationId,

    [string]$CatalogPath = (Join-Path $PSScriptRoot 'services-catalog.json')
)

$ErrorActionPreference = 'Stop'
$ApiUrl = $ApiUrl.TrimEnd('/')

if (-not (Test-Path $CatalogPath)) {
    throw "Файл каталога не найден: $CatalogPath"
}

$catalog = Get-Content -Path $CatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json

function Get-OrgQuery {
    if ([string]::IsNullOrWhiteSpace($OrganizationId)) { return '' }
    return "?organizationId=$OrganizationId"
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body
    )
    $uri = "$ApiUrl$Path"
    $headers = @{
        Authorization = "Bearer $Token"
        'Content-Type' = 'application/json; charset=utf-8'
    }
    $params = @{
        Uri     = $uri
        Method  = $Method
        Headers = $headers
    }
    if ($Body) {
        $json = $Body | ConvertTo-Json -Depth 10 -Compress
        $params['Body'] = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    return Invoke-RestMethod @params
}

Write-Host "== AIDA Service Catalog Import ==" -ForegroundColor Cyan
Write-Host "API:        $ApiUrl"
Write-Host "Catalog:    $CatalogPath"
if ($OrganizationId) { Write-Host "Org:        $OrganizationId (DEVELOPER режим)" }
Write-Host ""

Write-Host "Получаю существующие категории..." -ForegroundColor Yellow
$existingCats = Invoke-Api -Method 'GET' -Path "/services/categories$(Get-OrgQuery)"
$catByName = @{}
foreach ($c in $existingCats) { $catByName[$c.name.Trim().ToLowerInvariant()] = $c }
Write-Host ("  найдено категорий: {0}" -f $existingCats.Count)

Write-Host "Получаю существующие услуги..." -ForegroundColor Yellow
$existingServices = Invoke-Api -Method 'GET' -Path "/services$(Get-OrgQuery)"
$svcKey = {
    param($name, $audience)
    "$($name.Trim().ToLowerInvariant())|$audience"
}
$existingSvcSet = @{}
foreach ($s in $existingServices) {
    $k = & $svcKey $s.name $s.audience
    $existingSvcSet[$k] = $true
}
Write-Host ("  найдено услуг: {0}" -f $existingServices.Count)
Write-Host ""

$createdCats = 0
$createdSvcs = 0
$skippedSvcs = 0
$errors = @()

foreach ($cat in $catalog.categories) {
    $catKey = $cat.name.Trim().ToLowerInvariant()
    $catObj = $catByName[$catKey]

    if (-not $catObj) {
        Write-Host ("[+] Создаю категорию: {0}" -f $cat.name) -ForegroundColor Green
        try {
            $catObj = Invoke-Api -Method 'POST' -Path "/services/categories$(Get-OrgQuery)" -Body @{
                name     = $cat.name
                isActive = $true
            }
            $catByName[$catKey] = $catObj
            $createdCats++
        } catch {
            $msg = "Не удалось создать категорию '$($cat.name)': $($_.Exception.Message)"
            Write-Host "[!] $msg" -ForegroundColor Red
            $errors += $msg
            continue
        }
    } else {
        Write-Host ("[=] Категория уже есть: {0} ({1})" -f $cat.name, $catObj.id) -ForegroundColor DarkGray
    }

    foreach ($svc in $cat.services) {
        $audience = if ($cat.audience) { $cat.audience } else { 'WOMEN' }
        $k = & $svcKey $svc.name $audience
        if ($existingSvcSet.ContainsKey($k)) {
            $skippedSvcs++
            continue
        }
        $body = @{
            name               = $svc.name
            defaultDurationMin = [int]$svc.duration
            defaultPrice       = [int]$svc.price
            categoryId         = $catObj.id
            audience           = $audience
        }
        try {
            $null = Invoke-Api -Method 'POST' -Path "/services$(Get-OrgQuery)" -Body $body
            Write-Host ("    + {0} — {1}тг / {2}мин" -f $svc.name, $svc.price, $svc.duration)
            $existingSvcSet[$k] = $true
            $createdSvcs++
        } catch {
            $msg = "Услуга '$($svc.name)' ($($cat.name)): $($_.Exception.Message)"
            Write-Host "    ! $msg" -ForegroundColor Red
            $errors += $msg
        }
    }
}

Write-Host ""
Write-Host "== Итого ==" -ForegroundColor Cyan
Write-Host ("Создано категорий: {0}" -f $createdCats)
Write-Host ("Создано услуг:     {0}" -f $createdSvcs)
Write-Host ("Пропущено (уже были): {0}" -f $skippedSvcs)
if ($errors.Count -gt 0) {
    Write-Host ("Ошибок: {0}" -f $errors.Count) -ForegroundColor Red
    $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    exit 1
}
Write-Host "Готово." -ForegroundColor Green
