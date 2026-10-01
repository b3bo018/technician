param(
    [Parameter(Mandatory = $true)]
    [string]$ReleaseNotes
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$javaHome = (Resolve-Path (Join-Path $projectRoot '.tools\jdk21\jdk-21.0.12.1+1')).Path
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$env:Path"

if (-not (Test-Path (Join-Path $projectRoot 'android\securetrack-upload.jks'))) {
    throw 'SecureTrack upload keystore is missing.'
}
if (-not (Test-Path (Join-Path $projectRoot 'android\securetrack-signing.properties'))) {
    throw 'SecureTrack signing properties are missing.'
}

Push-Location $projectRoot
try {
    pnpm run build
    if ($LASTEXITCODE -ne 0) { throw 'Web build failed.' }
    pnpm exec cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'Capacitor sync failed.' }
    Push-Location android
    try {
        .\gradlew.bat assembleRelease bundleRelease
        if ($LASTEXITCODE -ne 0) { throw 'Android release build failed.' }
    } finally {
        Pop-Location
    }
    pnpm exec firebase appdistribution:distribute `
        'android\app\build\outputs\apk\release\app-release.apk' `
        --app '1:585832495483:android:edccd52a7711b1ff3565de' `
        --project 'securetrack-technician-b3bo018' `
        --groups 'securetrack-staff' `
        --release-notes $ReleaseNotes
    if ($LASTEXITCODE -ne 0) { throw 'Firebase App Distribution upload failed.' }
} finally {
    Pop-Location
}
