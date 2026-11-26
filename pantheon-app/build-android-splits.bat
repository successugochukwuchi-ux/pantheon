@echo off
setlocal EnableExtensions EnableDelayedExpansion

pushd "%~dp0"

set "DO_INSTALL=0"
set "DO_PREBUILD=0"
set "DO_CLEAN=0"
set "SKIP_OPEN=0"
set "IS_DOUBLE_CLICK=0"

echo %cmdcmdline% | find /i "/c" >nul && set "IS_DOUBLE_CLICK=1"

:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--install" set "DO_INSTALL=1"
if /i "%~1"=="--prebuild" set "DO_PREBUILD=1"
if /i "%~1"=="--clean" set "DO_CLEAN=1"
if /i "%~1"=="--skip-open" set "SKIP_OPEN=1"
if /i "%~1"=="--help" goto show_help
if /i "%~1"=="-h" goto show_help
shift
goto parse_args

:show_help
echo.
echo CoLearn Android Split APK Builder (Windows)
echo Usage: build-android-splits.bat [options]
echo.
echo Options:
echo   --install     Force npm install even if package.json has not changed
echo   --prebuild    Re-run expo prebuild (without wiping android\ keys)
echo   --clean       Wipe and regenerate android\ via expo prebuild --clean
echo   --skip-open   Do not open dist-apks\ in Explorer after finishing
echo   --help        Show this help message
echo.
popd
exit /b 0

:args_done
echo ============================================================
echo   CoLearn Android Split APK Builder
echo   Outputs: arm64-v8a (64-bit) + armeabi-v7a (32-bit)
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH. Install Node.js LTS first.
  goto fail
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found in PATH.
  goto fail
)

where java >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Java JDK was not found in PATH. Install JDK 17 and set JAVA_HOME.
  goto fail
)

for /f "delims=" %%V in ('node -p "JSON.parse(require('fs').readFileSync('app.json','utf8')).expo.version"') do set "APP_VERSION=%%V"
for /f "delims=" %%C in ('node -p "JSON.parse(require('fs').readFileSync('app.json','utf8')).expo.android.versionCode || 1"') do set "APP_VERSION_CODE=%%C"

echo [INFO] Target version from app.json: v%APP_VERSION% (versionCode %APP_VERSION_CODE%)
node plugins\sync-android-build.js check-version

rem --- Step 1: Check node_modules cleanly ---
set "NEED_NPM_INSTALL=0"
if not exist "node_modules" set "NEED_NPM_INSTALL=1"
if "%DO_INSTALL%"=="1" set "NEED_NPM_INSTALL=1"

if "%NEED_NPM_INSTALL%"=="0" (
  node plugins\sync-android-build.js check-deps
  if errorlevel 1 (
    echo [INFO] package.json changed since last install. Updating dependencies...
    set "NEED_NPM_INSTALL=1"
  )
)

if "%NEED_NPM_INSTALL%"=="1" (
  echo [1/4] Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    goto fail
  )
  node plugins\sync-android-build.js save-deps-hash
) else (
  echo [1/4] Dependencies up to date. Skipping npm install.
)

rem --- Step 2: Prebuild only when missing, clean requested, or missing withAbiSplits ---
set "NEED_PREBUILD=0"
if "%DO_CLEAN%"=="1" set "NEED_PREBUILD=1"
if "%DO_PREBUILD%"=="1" set "NEED_PREBUILD=1"
if not exist "android\app\build.gradle" (
  echo [INFO] android\ directory not found. Running first-time Expo prebuild...
  set "NEED_PREBUILD=1"
) else (
  findstr /c:"[withAbiSplits]" "android\app\build.gradle" >nul 2>nul
  if errorlevel 1 (
    echo [INFO] ABI split config not found in android\app\build.gradle. Updating Android project...
    set "NEED_PREBUILD=1"
  )
)

if "%DO_CLEAN%"=="1" (
  echo [2/4] Cleaning and regenerating Android native project...
  call npx expo prebuild --platform android --clean --no-install
  if errorlevel 1 (
    echo [ERROR] expo prebuild --clean failed.
    goto fail
  )
) else if "%NEED_PREBUILD%"=="1" (
  echo [2/4] Running Expo prebuild for Android...
  call npx expo prebuild --platform android --no-install
  if errorlevel 1 (
    echo [ERROR] expo prebuild failed.
    goto fail
  )
) else (
  echo [2/4] Native android\ project ready. Keeping C++ and Gradle build cache intact.
)

node plugins\sync-android-build.js sync-gradle
if errorlevel 1 (
  echo [ERROR] Failed to sync Gradle configuration.
  goto fail
)

if not exist "android\gradlew.bat" (
  echo [ERROR] android\gradlew.bat is missing. Try running with --clean.
  goto fail
)

rem --- Step 3: Build Split Release APKs ---
echo [3/4] Running Gradle assembleRelease (parallel + build cache)...
set "NODE_ENV=production"
pushd android
call gradlew.bat assembleRelease --parallel --build-cache --configure-on-demand
set "GRADLE_ERR=%ERRORLEVEL%"
popd

if not "%GRADLE_ERR%"=="0" (
  echo [ERROR] Gradle assembleRelease failed with exit code %GRADLE_ERR%.
  goto fail
)

rem --- Step 4: Collect and rename split APKs ---
echo [4/4] Packaging split APKs into dist-apks\...
if not exist "dist-apks" mkdir "dist-apks"

set "APK_ARM64_SRC="
set "APK_ARM32_SRC="

for %%F in ("android\app\build\outputs\apk\release\*arm64-v8a*release*.apk") do set "APK_ARM64_SRC=%%~fF"
for %%F in ("android\app\build\outputs\apk\release\*armeabi-v7a*release*.apk") do set "APK_ARM32_SRC=%%~fF"

if "%APK_ARM64_SRC%"=="" (
  echo [ERROR] Could not find arm64-v8a release APK in android\app\build\outputs\apk\release\.
  goto fail
)
if "%APK_ARM32_SRC%"=="" (
  echo [ERROR] Could not find armeabi-v7a release APK in android\app\build\outputs\apk\release\.
  goto fail
)

set "OUT_ARM64=dist-apks\CoLearn-v%APP_VERSION%-arm64-v8a.apk"
set "OUT_ARM32=dist-apks\CoLearn-v%APP_VERSION%-armeabi-v7a.apk"

copy /y "%APK_ARM64_SRC%" "%OUT_ARM64%" >nul
if errorlevel 1 goto fail
copy /y "%APK_ARM32_SRC%" "%OUT_ARM32%" >nul
if errorlevel 1 goto fail

echo.
echo ============================================================
echo   BUILD SUCCEEDED
echo ============================================================
node plugins\sync-android-build.js print-apks "%OUT_ARM64%" "%OUT_ARM32%"
echo ============================================================
echo.

if "%SKIP_OPEN%"=="0" (
  start "" explorer.exe "%CD%\dist-apks"
)

popd
if "%IS_DOUBLE_CLICK%"=="1" pause
exit /b 0

:fail
echo.
echo Build aborted. Fix the error above and re-run build-android-splits.bat.
popd
if "%IS_DOUBLE_CLICK%"=="1" pause
exit /b 1
