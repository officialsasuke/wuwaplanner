# WuWa Pull Planner - finds your Convene history link in the Wuthering Waves log
# and copies it to the clipboard. It only reads log files, it changes nothing.
#
# Usage (PowerShell):   irm "https://<your-site>/import.ps1" | iex
# With a game folder:   & ([scriptblock]::Create((irm "https://<your-site>/import.ps1"))) "D:\Games\Wuthering Waves"

& {
$GamePath = ""
if ($args.Count -gt 0) { $GamePath = [string]$args[0] }
$ErrorActionPreference = "SilentlyContinue"
$pattern = 'https://aki-gm-resources(?:-oversea)?\.aki-game\.(?:net|com)/aki/gacha/index\.html#/record[^"\s]*'

Write-Host ""
Write-Host "  WuWa Pull Planner - Convene link finder" -ForegroundColor Yellow
Write-Host ""

# Newer game versions obfuscate the log with a simple XOR. Decoding in C# is much faster.
if (-not ("WuwaLogXor" -as [type])) {
    Add-Type -TypeDefinition @"
public static class WuwaLogXor {
    public static byte[] Decode(byte[] a) {
        var o = new byte[a.Length];
        for (int i = 0; i < a.Length; i++) {
            byte b = a[i];
            o[i] = (byte)(b ^ ((b & 1) != 0 ? 0xA5 : 0xEF));
        }
        return o;
    }
}
"@
}

$roots = New-Object System.Collections.Generic.List[string]
function Add-Root([string]$p) {
    if ($p) {
        $p = $p.Trim().Trim('"')
        if ($p -and -not $roots.Contains($p)) { $roots.Add($p) }
    }
}

Add-Root $GamePath

# 1) Programs Windows has seen starting (MuiCache)
$mui = Get-ItemProperty "HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\MuiCache"
if ($mui) {
    foreach ($prop in $mui.PSObject.Properties) {
        $n = [string]$prop.Name
        $low = $n.ToLower()
        if ($low.Contains("client-win64-shipping.exe") -and (($low + [string]$prop.Value).ToLower().Contains("wuthering"))) {
            $i = $low.IndexOf("\client\")
            if ($i -gt 0) { Add-Root $n.Substring(0, $i) }
        }
    }
}

# 2) Installed programs
foreach ($key in @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*")) {
    Get-ItemProperty $key | Where-Object { $_.DisplayName -match "wuthering" } | ForEach-Object {
        Add-Root $_.InstallPath
        Add-Root $_.InstallLocation
    }
}

# 3) Usual folders on every drive
$rel = @(
    "Wuthering Waves", "Wuthering Waves Game", "Games\Wuthering Waves", "Games\Wuthering Waves Game",
    "Program Files\Wuthering Waves", "Program Files (x86)\Wuthering Waves",
    "Program Files\Epic Games\WutheringWavesj3oFh", "Program Files (x86)\Epic Games\WutheringWavesj3oFh",
    "SteamLibrary\steamapps\common\Wuthering Waves", "Steam\steamapps\common\Wuthering Waves",
    "Games\Steam\steamapps\common\Wuthering Waves",
    "Program Files (x86)\Steam\steamapps\common\Wuthering Waves", "Program Files\Steam\steamapps\common\Wuthering Waves"
)
foreach ($drive in (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Root })) {
    foreach ($r in $rel) { Add-Root (Join-Path $drive.Root $r) }
}

# Find log files
$logRel = @(
    "Client\Saved\Logs\Client.log",
    "Client\Binaries\Win64\ThirdParty\KrPcSdk_Global\KRSDKRes\KRSDKWebView\debug.log"
)
$logs = @{}
$checked = @()
foreach ($root in $roots) {
    if (-not (Test-Path -LiteralPath $root -PathType Container)) { continue }
    $checked += $root
    foreach ($base in @($root, (Join-Path $root "Wuthering Waves Game"))) {
        foreach ($l in $logRel) {
            $p = Join-Path $base $l
            if (Test-Path -LiteralPath $p -PathType Leaf) { $logs[(Get-Item -LiteralPath $p).FullName] = $true }
        }
    }
}

function Read-Shared([string]$path) {
    # The game keeps the log open, so open it with shared read/write access.
    $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
        $ms = New-Object System.IO.MemoryStream
        $fs.CopyTo($ms)
        return , $ms.ToArray()
    } finally { $fs.Close() }
}

function Find-Url([byte[]]$bytes) {
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    $m = [regex]::Matches($text, $pattern)
    if ($m.Count -gt 0) { return $m[$m.Count - 1].Value }
    $text = [System.Text.Encoding]::UTF8.GetString([WuwaLogXor]::Decode($bytes))
    $m = [regex]::Matches($text, $pattern)
    if ($m.Count -gt 0) { return $m[$m.Count - 1].Value }
    return $null
}

$url = $null
$sorted = $logs.Keys | ForEach-Object { Get-Item -LiteralPath $_ } | Sort-Object LastWriteTime -Descending
foreach ($f in $sorted) {
    try {
        $url = Find-Url (Read-Shared $f.FullName)
    } catch {
        Write-Host "  Could not read $($f.FullName): $($_.Exception.Message)" -ForegroundColor DarkGray
    }
    if ($url) { break }
}

if ($url) {
    Set-Clipboard -Value $url
    Write-Host "  Found it. The Convene link is now in your clipboard." -ForegroundColor Green
    Write-Host "  Go back to the planner and paste it (Ctrl+V)." -ForegroundColor Green
} elseif ($checked.Count -eq 0) {
    Write-Host "  Game folder not found." -ForegroundColor Red
    Write-Host "  Run it again with your game folder, for example:" -ForegroundColor Red
    Write-Host '  & ([scriptblock]::Create((irm "<this script link>"))) "D:\Games\Wuthering Waves"' -ForegroundColor Gray
} elseif ($logs.Count -eq 0) {
    Write-Host "  Game folder found, but no log file. Open Convene > History in the game once." -ForegroundColor Red
} else {
    Write-Host "  Log found, but no link. Open Convene > History in the game, wait until it loads, then run this again." -ForegroundColor Red
}
if ($checked.Count -gt 0 -and -not $url) {
    Write-Host ""
    Write-Host "  Folders checked:" -ForegroundColor DarkGray
    $checked | ForEach-Object { Write-Host "   $_" -ForegroundColor DarkGray }
}
Write-Host ""
} @args
