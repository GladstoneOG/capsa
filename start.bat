@echo off
setlocal enabledelayedexpansion

title Capsa Banting Local Hosting Launcher

set "IP_FILE=ip.txt"

echo ====================================================
echo  Capsa Banting - Local Hosting Service Starter
echo ====================================================
echo.

:: Check if ip.txt exists
if not exist "%IP_FILE%" (
    echo [INFO] "%IP_FILE%" not found. Attempting to auto-detect your local IP address...
    
    :: Get the active local IPv4 address using PowerShell (filters out loopback and APIPA addresses)
    for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notlike '*Loopback*'} | Select-Object -ExpandProperty IPAddress -First 1"`) do (
        set "DETECTED_IP=%%i"
    )
    
    :: If detection failed, default to localhost
    if "!DETECTED_IP!"=="" (
        set "DETECTED_IP=127.0.0.1"
        echo [WARNING] Could not auto-detect active local IP. Defaulting to 127.0.0.1.
    ) else (
        echo [SUCCESS] Auto-detected local IP: !DETECTED_IP!
    )
    
    :: Save detected IP to ip.txt
    echo !DETECTED_IP!> "%IP_FILE%"
    echo [INFO] Created "%IP_FILE%" with default IP: !DETECTED_IP!
    echo        (You can open ip.txt to edit this IP at any time)
    echo.
)

:: Read the IP from ip.txt
set /p SERVER_IP=<"%IP_FILE%"

:: Trim any potential trailing/leading spaces or quotes from SERVER_IP
set "SERVER_IP=%SERVER_IP: =%"
set "SERVER_IP=%SERVER_IP:"=%"

if "%SERVER_IP%"=="" (
    echo [ERROR] ip.txt is empty! Please write your server IP address inside ip.txt.
    echo Defaulting to 127.0.0.1...
    set "SERVER_IP=127.0.0.1"
    echo.
)

echo ----------------------------------------------------
echo  Current Configuration:
echo    * Server IP Address: %SERVER_IP%
echo    * Frontend (Game UI): http://%SERVER_IP%:5173
echo    * Backend (Sockets):  http://%SERVER_IP%:3001
echo ----------------------------------------------------
echo.

:: Set environment variable for Vite client so it knows where to connect
set VITE_SERVER_URL=http://%SERVER_IP%:3001

echo [INFO] Starting Backend Server in a new window...
start "Capsa Banting - Backend" cmd /k "node server/server.js"

echo [INFO] Starting Frontend Dev Server (Vite) in a new window...
start "Capsa Banting - Frontend" cmd /k "npm run dev -- --host"

echo.
echo [SUCCESS] Both servers have been launched in separate windows!
echo  - To play, tell your friends to open http://%SERVER_IP%:5173 in their browser.
echo  - To stop the hosting, simply close the backend and frontend command windows.
echo.
echo Press any key to exit this launcher window...
pause > nul
