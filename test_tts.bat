@echo off
:: TTS Test Suite for Windows CMD / PowerShell
:: This script tests both GET and POST endpoints of the Pantheon Edge TTS backend

setlocal enabledelayedexpansion

echo ===================================================
echo   COLEARN/PANTHEON EDGE-TTS BACKEND TESTER (WINDOWS)
echo ===================================================
echo.

:: Initialize log file
set LOG_FILE=logs.txt
echo =================================================== > !LOG_FILE!
echo   COLEARN/PANTHEON TTS DIAGNOSTIC LOGS >> !LOG_FILE!
echo   Date/Time: %DATE% %TIME% >> !LOG_FILE!
echo =================================================== >> !LOG_FILE!
echo. >> !LOG_FILE!

:: 1. Configuration variables (Change these if needed)
set DEFAULT_DEV_URL=https://ais-dev-iuwo2zt3vdgdkwbrhidmyy-184499856098.europe-west3.run.app
set DEFAULT_PRE_URL=https://ais-pre-iuwo2zt3vdgdkwbrhidmyy-184499856098.europe-west3.run.app
set DEFAULT_TEXT=Hello, this is a diagnostic test of the Microsoft Edge Text to Speech system. It is currently streaming directly from the Cloud Run server.
set TEST_VOICE=en-US-AriaNeural

:: Ask user which backend to test
echo [1] Test Development Server: %DEFAULT_DEV_URL%
echo [2] Test Preview Server: %DEFAULT_PRE_URL%
echo [3] Custom Server URL
echo.
set /p CHOICE="Choose backend to test [1-3, default=1]: "

if "%CHOICE%"=="2" (
    set TARGET_URL=%DEFAULT_PRE_URL%
) else if "%CHOICE%"=="3" (
    set /p TARGET_URL="Enter custom base URL (e.g. http://localhost:3000): "
) else (
    set TARGET_URL=%DEFAULT_DEV_URL%
)

echo.
set /p USER_TEXT="Enter custom text to speak [Press Enter for default]: "
if "!USER_TEXT!"=="" (
    set TEST_TEXT=!DEFAULT_TEXT!
) else (
    set TEST_TEXT=!USER_TEXT!
)

echo.
echo ====================================================================
echo   SANDBOX COOKIE GATING OPTION
echo --------------------------------------------------------------------
echo   Since AI Studio development and preview links are sandboxed, 
echo   direct requests from curl or mobile apps will get redirected to 
echo   /__cookie_check.html unless you supply the active browser Cookie.
echo.
echo   To test properly, open your browser, sign in, open Developer Tools
echo   (F12), go to Network, click any request, and copy the value of the
echo   "Cookie" header (specifically __SECURE-aistudio_auth_session).
echo ====================================================================
echo.
set /p USER_COOKIE="Paste your browser Cookie [Press Enter to test without cookie]: "

echo Testing URL: !TARGET_URL! >> !LOG_FILE!
echo Text: !TEST_TEXT! >> !LOG_FILE!
echo Voice: !TEST_VOICE! >> !LOG_FILE!
if not "!USER_COOKIE!"=="" (
    echo Cookie: [PROVIDED] >> !LOG_FILE!
) else (
    echo Cookie: [NONE] >> !LOG_FILE!
)

echo.
echo Target URL set to: !TARGET_URL!
echo Test Text: "!TEST_TEXT!"
echo Test Voice: !TEST_VOICE!
echo.
echo ===================================================
echo 1. TESTING GET ENDPOINT (/api/tts via GET)
echo ===================================================
echo Sending GET request...
echo. >> !LOG_FILE!
echo --- TESTING GET ENDPOINT --- >> !LOG_FILE!

:: Build curl arguments
set CURL_OPTS=-i -s -G --data-urlencode "text=!TEST_TEXT!" --data-urlencode "voice=!TEST_VOICE!"
if not "!USER_COOKIE!"=="" (
    set CURL_OPTS=!CURL_OPTS! -H "Cookie: !USER_COOKIE!"
)

echo Command: curl !CURL_OPTS! "!TARGET_URL!/api/tts" >> !LOG_FILE!
curl !CURL_OPTS! "!TARGET_URL!/api/tts" -o test_get_raw.tmp 2>> !LOG_FILE!

:: Separate headers and body for analysis
powershell -Command "$raw = [System.IO.File]::ReadAllBytes('test_get_raw.tmp'); $idx = 0; for($i=0; $i -lt $raw.Length-3; $i++){ if($raw[$i] -eq 13 -and $raw[$i+1] -eq 10 -and $raw[$i+2] -eq 13 -and $raw[$i+3] -eq 10){ $idx = $i+4; break; } }; if($idx -gt 0){ [System.IO.File]::WriteAllBytes('test_get_headers.txt', $raw[0..($idx-5)]); [System.IO.File]::WriteAllBytes('test_get.mp3', $raw[$idx..($raw.Length-1)]); } else { Copy-Item 'test_get_raw.tmp' 'test_get_headers.txt' }" 2>> !LOG_FILE!

if not exist test_get_headers.txt (
    copy /y test_get_raw.tmp test_get_headers.txt >nul
)

echo.
echo --- RESPONSE HEADERS (GET) ---
type test_get_headers.txt 2>nul | findstr /I "HTTP/ content-type x-text-length x-cloud-trace-context error server location set-cookie"
echo ------------------------------
echo.

echo --- GET HEADERS --- >> !LOG_FILE!
type test_get_headers.txt >> !LOG_FILE! 2>nul
echo ------------------- >> !LOG_FILE!

if exist test_get.mp3 (
    for %%A in (test_get.mp3) do set GET_SIZE=%%~zA
    echo GET File size: !GET_SIZE! bytes >> !LOG_FILE!
    if !GET_SIZE! gtr 1000 (
        :: Double check if it's HTML masquerading as MP3
        powershell -Command "$bytes = [System.IO.File]::ReadAllBytes('test_get.mp3'); if($bytes.Length -gt 15 -and $bytes[0] -eq 60 -and $bytes[1] -eq 33 -and $bytes[2] -eq 68 -and $bytes[3] -eq 79){ Write-Output 'IS_HTML' } else { Write-Output 'IS_AUDIO' }" > is_html_get.tmp
        set /p GET_TYPE=<is_html_get.tmp
        del is_html_get.tmp 2>nul
        
        if "!GET_TYPE!"=="IS_HTML" (
            echo [FAILED] GET response was intercepted by the AI Studio proxy sandbox! 
            echo          It downloaded an HTML verification page instead of an audio file.
            echo          Please provide a valid browser Cookie.
            echo [FAILED] GET response was intercepted by proxy (HTML file downloaded instead of audio) >> !LOG_FILE!
        ) else (
            echo [SUCCESS] GET TTS request succeeded! Received !GET_SIZE! bytes.
            echo Saved file as: test_get.mp3
            echo GET request SUCCESS >> !LOG_FILE!
        )
    ) else (
        echo [WARNING] GET response was very small (!GET_SIZE! bytes). It might contain an error.
        echo Content of response:
        type test_get_raw.tmp 2>nul
        echo Response body: >> !LOG_FILE!
        type test_get_raw.tmp >> !LOG_FILE! 2>nul
    )
) else (
    echo [FAILED] No audio output received for GET request.
    echo GET request FAILED (No output) >> !LOG_FILE!
)

echo.
echo ===================================================
echo 2. TESTING POST ENDPOINT (/api/tts via POST)
echo ===================================================
echo Sending POST request...
echo. >> !LOG_FILE!
echo --- TESTING POST ENDPOINT --- >> !LOG_FILE!

:: Prepare JSON payload securely using PowerShell environment variables to avoid quote/escaping issues
powershell -Command "$body = @{ text=$env:TEST_TEXT; voice=$env:TEST_VOICE } | ConvertTo-Json -Compress; [System.IO.File]::WriteAllText('payload.json', $body, [System.Text.Encoding]::UTF8)" 2>> !LOG_FILE!

:: Build curl arguments for POST
set CURL_POST_OPTS=-i -s -X POST -H "Content-Type: application/json" -d @payload.json
if not "!USER_COOKIE!"=="" (
    set CURL_POST_OPTS=!CURL_POST_OPTS! -H "Cookie: !USER_COOKIE!"
)

echo Command: curl !CURL_POST_OPTS! "!TARGET_URL!/api/tts" >> !LOG_FILE!
curl !CURL_POST_OPTS! "!TARGET_URL!/api/tts" -o test_post_raw.tmp 2>> !LOG_FILE!

:: Separate headers and body
powershell -Command "$raw = [System.IO.File]::ReadAllBytes('test_post_raw.tmp'); $idx = 0; for($i=0; $i -lt $raw.Length-3; $i++){ if($raw[$i] -eq 13 -and $raw[$i+1] -eq 10 -and $raw[$i+2] -eq 13 -and $raw[$i+3] -eq 10){ $idx = $i+4; break; } }; if($idx -gt 0){ [System.IO.File]::WriteAllBytes('test_post_headers.txt', $raw[0..($idx-5)]); [System.IO.File]::WriteAllBytes('test_post.mp3', $raw[$idx..($raw.Length-1)]); } else { Copy-Item 'test_post_raw.tmp' 'test_post_headers.txt' }" 2>> !LOG_FILE!

if not exist test_post_headers.txt (
    copy /y test_post_raw.tmp test_post_headers.txt >nul
)

echo.
echo --- RESPONSE HEADERS (POST) ---
type test_post_headers.txt 2>nul | findstr /I "HTTP/ content-type x-text-length x-cloud-trace-context error server location set-cookie"
echo ------------------------------
echo.

echo --- POST HEADERS --- >> !LOG_FILE!
type test_post_headers.txt >> !LOG_FILE! 2>nul
echo -------------------- >> !LOG_FILE!

if exist test_post.mp3 (
    for %%A in (test_post.mp3) do set POST_SIZE=%%~zA
    echo POST File size: !POST_SIZE! bytes >> !LOG_FILE!
    if !POST_SIZE! gtr 1000 (
        :: Double check if it's HTML masquerading as MP3
        powershell -Command "$bytes = [System.IO.File]::ReadAllBytes('test_post.mp3'); if($bytes.Length -gt 15 -and $bytes[0] -eq 60 -and $bytes[1] -eq 33 -and $bytes[2] -eq 68 -and $bytes[3] -eq 79){ Write-Output 'IS_HTML' } else { Write-Output 'IS_AUDIO' }" > is_html_post.tmp
        set /p POST_TYPE=<is_html_post.tmp
        del is_html_post.tmp 2>nul
        
        if "!POST_TYPE!"=="IS_HTML" (
            echo [FAILED] POST response was intercepted by the AI Studio proxy sandbox! 
            echo          It downloaded an HTML verification page instead of an audio file.
            echo          Please provide a valid browser Cookie.
            echo [FAILED] POST response was intercepted by proxy (HTML file downloaded instead of audio) >> !LOG_FILE!
        ) else (
            echo [SUCCESS] POST TTS request succeeded! Received !POST_SIZE! bytes.
            echo Saved file as: test_post.mp3
            echo POST request SUCCESS >> !LOG_FILE!
        )
    ) else (
        echo [WARNING] POST response was very small (!POST_SIZE! bytes). It might contain an error.
        echo Content of response:
        type test_post_raw.tmp 2>nul
        echo Response body: >> !LOG_FILE!
        type test_post_raw.tmp >> !LOG_FILE! 2>nul
    )
) else (
    echo [FAILED] No audio output received for POST request.
    echo POST request FAILED (No output) >> !LOG_FILE!
)

:: Diagnostic summary
echo.
echo ===================================================
echo DIAGNOSTICS COMPLETE
echo ===================================================
echo  - Detailed telemetry saved to: %CD%\logs.txt
echo  - If you received HTML responses, it means the sandbox gateway blocked curl.
echo  - Follow the Cookie gating instructions inside logs.txt to bypass this check.
echo.
echo =================================================== >> !LOG_FILE!
echo DIAGNOSTICS END >> !LOG_FILE!
echo =================================================== >> !LOG_FILE!

:: Clean up temp files
del payload.json 2>nul
del test_get_raw.tmp 2>nul
del test_post_raw.tmp 2>nul
pause
