@echo off
setlocal

cd /d "%~dp0"

echo Installing npm dependencies...
call npm install
if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
)

echo.
echo Running tests...
call npm test
if errorlevel 1 (
    echo.
    echo npm test failed.
    pause
    exit /b 1
)

echo.
echo Done.
pause
