@echo off
setlocal
cd /d "%~dp0"
title Peepshow Product v11
where py >nul 2>nul
if %errorlevel% equ 0 (
    py -3 serve.py
) else (
    python serve.py
)
pause
