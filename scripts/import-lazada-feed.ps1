param(
  [Parameter(Mandatory = $true)]
  [string]$SourcePath,

  [string]$OutputPath = "C:\Users\kenda\secret-santa-app\lib\affiliate\lazada-feed-data.generated.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $SourcePath)) {
  throw "Source file not found: $SourcePath"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

$InvariantCulture = [System.Globalization.CultureInfo]::InvariantCulture

function Get-ZipEntryText {
  param(
    [System.IO.Compression.ZipArchive]$Archive,
    [string]$EntryPath
  )

  $entry = $Archive.GetEntry($EntryPath)

  if (-not $entry) {
    return $null
  }

  $stream = $entry.Open()
  $reader = New-Object System.IO.StreamReader($stream)

  try {
    return $reader.ReadToEnd()
  }
  finally {
    $reader.Dispose()
    $stream.Dispose()
  }
}

function Get-SharedStrings {
  param([System.IO.Compression.ZipArchive]$Archive)

  $sharedStringsXml = Get-ZipEntryText -Archive $Archive -EntryPath "xl/sharedStrings.xml"

  if (-not $sharedStringsXml) {
    return @()
  }

  [xml]$sharedStringsDocument = $sharedStringsXml
  $sharedStrings = @()

  foreach ($item in $sharedStringsDocument.sst.si) {
    $textNodes = @()

    if ($item.t) {
      $textNodes += [string]$item.t
    }

    if ($item.r) {
      foreach ($run in $item.r) {
        if ($run.t) {
          $textNodes += [string]$run.t
        }
      }
    }

    $sharedStrings += (($textNodes -join "").Trim())
  }

  return $sharedStrings
}

function Convert-CellReferenceToColumnIndex {
  param([string]$CellReference)

  $letters = ($CellReference -replace "[^A-Z]", "")
  $columnIndex = 0

  foreach ($letter in $letters.ToCharArray()) {
    $columnIndex = ($columnIndex * 26) + ([int][char]$letter - [int][char]'A' + 1)
  }

  return $columnIndex - 1
}

function Get-CellValue {
  param(
    $Cell,
    [string[]]$SharedStrings
  )

  $cellType = [string]$Cell.t

  if ($cellType -eq "s") {
    $sharedStringIndex = [int]$Cell.v
    return $SharedStrings[$sharedStringIndex]
  }

  if ($cellType -eq "inlineStr" -and $Cell.is -and $Cell.is.t) {
    return [string]$Cell.is.t
  }

  if ($Cell.v) {
    return [string]$Cell.v
  }

  return ""
}

function Normalize-FeedFieldValue {
  param(
    [string]$FieldName,
    [string]$Value
  )

  $trimmed = $Value.Trim()

  if ([string]::IsNullOrWhiteSpace($trimmed)) {
    return ""
  }

  if (@("skuId", "itemId", "sellerId") -contains $FieldName) {
    try {
      $parsedNumber = [decimal]::Parse($trimmed, [System.Globalization.NumberStyles]::Any, $InvariantCulture)
      return $parsedNumber.ToString("0", $InvariantCulture)
    }
    catch {
      return $trimmed
    }
  }

  return $trimmed
}

$headerMap = @{
  "date" = "date"
  "sku_id" = "skuId"
  "item_id" = "itemId"
  "product_name" = "productName"
  "sale_price" = "salePrice"
  "discounted_price" = "discountedPrice"
  "discounted_percentage" = "discountedPercentage"
  "picture_url" = "pictureUrl"
  "product_url" = "productUrl"
  "brand" = "brand"
  "maximum commission_rate" = "maximumCommissionRate"
  "category lv1" = "categoryLv1"
  "seller id" = "sellerId"
  "invite id" = "inviteId"
  "dm invite start time" = "dmInviteStartTime"
  "dm invite end time" = "dmInviteEndTime"
  "promo_link" = "promoLink"
  "promo_deep_link" = "promoDeepLink"
  "promo_short_link" = "promoShortLink"
  "promo_code" = "promoCode"
  "sub_aff_id" = "subAffId"
  "sub_id 1" = "subId1"
  "sub_id 2" = "subId2"
  "sub_id 3" = "subId3"
  "media landing page" = "mediaLandingPage"
  "sub_id 4" = "subId4"
  "sub_id 5" = "subId5"
  "sub_id 6" = "subId6"
  "pick channel" = "pickChannel"
}

$archive = [System.IO.Compression.ZipFile]::OpenRead($SourcePath)

try {
  $sharedStrings = Get-SharedStrings -Archive $archive
  $sheetXml = Get-ZipEntryText -Archive $archive -EntryPath "xl/worksheets/sheet1.xml"

  if (-not $sheetXml) {
    throw "The workbook does not contain xl/worksheets/sheet1.xml"
  }

  [xml]$sheetDocument = $sheetXml
  $rows = @($sheetDocument.worksheet.sheetData.row)

  if ($rows.Count -eq 0) {
    throw "The workbook does not contain any rows."
  }

  $headersByIndex = @{}

  foreach ($cell in $rows[0].c) {
    $columnIndex = Convert-CellReferenceToColumnIndex -CellReference ([string]$cell.r)
    $rawHeader = (Get-CellValue -Cell $cell -SharedStrings $sharedStrings).Trim().ToLowerInvariant()
    $normalizedHeader = ($rawHeader -replace "\s+", " ").Trim()

    if ($headerMap.ContainsKey($normalizedHeader)) {
      $headersByIndex[$columnIndex] = $headerMap[$normalizedHeader]
    }
  }

  $requiredFields = @(
    "date",
    "skuId",
    "itemId",
    "productName",
    "salePrice",
    "discountedPrice",
    "discountedPercentage",
    "pictureUrl",
    "productUrl",
    "brand",
    "maximumCommissionRate",
    "categoryLv1",
    "sellerId",
    "inviteId",
    "dmInviteStartTime",
    "dmInviteEndTime",
    "promoLink",
    "promoDeepLink",
    "promoShortLink",
    "promoCode",
    "subAffId",
    "subId1",
    "subId2",
    "subId3",
    "mediaLandingPage",
    "subId4",
    "subId5",
    "subId6",
    "pickChannel"
  )

  $records = New-Object System.Collections.Generic.List[object]

  foreach ($row in $rows | Select-Object -Skip 1) {
    $record = [ordered]@{}

    foreach ($field in $requiredFields) {
      $record[$field] = ""
    }

    foreach ($cell in $row.c) {
      $columnIndex = Convert-CellReferenceToColumnIndex -CellReference ([string]$cell.r)

      if (-not $headersByIndex.ContainsKey($columnIndex)) {
        continue
      }

      $fieldName = $headersByIndex[$columnIndex]
      $rawValue = Get-CellValue -Cell $cell -SharedStrings $sharedStrings
      $record[$fieldName] = Normalize-FeedFieldValue -FieldName $fieldName -Value $rawValue
    }

    if ([string]::IsNullOrWhiteSpace($record.itemId) -or [string]::IsNullOrWhiteSpace($record.productName)) {
      continue
    }

    $records.Add([pscustomobject]$record)
  }

  $outputDirectory = Split-Path -Parent $OutputPath

  if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
  }

  $json = $records | ConvertTo-Json -Depth 4

  if ($records.Count -eq 1) {
    $json = "[`n$json`n]"
  }
  Set-Content -LiteralPath $OutputPath -Value $json

  Write-Output "Imported $($records.Count) Lazada feed row(s) into $OutputPath"
}
finally {
  $archive.Dispose()
}
