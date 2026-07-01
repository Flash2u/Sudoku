@echo off
title Sub Sudoku - 數獨遊戲
echo ===================================================
echo   正在啟動 Sub Sudoku 數獨遊戲...
echo   本視窗是遊戲的運行伺服器，請勿在遊玩時將此視窗關閉。
echo ===================================================
echo.

:: 變更工作目錄至此批次檔所在的資料夾
cd /d "%~dp0"

:: 啟動 Vite 開發伺服器並自動在瀏覽器中打開網頁
cmd /c "npm run dev -- --open"

if %ERRORLEVEL% neq 0 (
    echo.
    echo [錯誤] 啟動失敗！請確認是否已經在該目錄下運行過 "npm install" 安裝依賴。
    echo.
    pause
)
