@echo off
chcp 65001 > nul

:: 檢查管理員權限
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ===================================================
    echo [錯誤] 權限不足！請在此檔案上按右鍵，點選「以系統管理員身分執行」！
    echo ===================================================
    pause
    exit /b 1
)

node "%~dp0scripts\deployStartup.js"
pause
