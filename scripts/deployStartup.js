import fs from 'fs';
import path from 'path';

const startupFolder = "C:\\ProgramData\\Microsoft\\Windows\\Start Menu\\Programs\\StartUp";

const psScriptContent = `# 檢查目前使用者是否已經安裝 Codex
$App = Get-AppxPackage -Name "*OpenAI.Codex*"
if ($null -eq $App) {
    # 執行靜默安裝
    Start-Process -FilePath "winget" -ArgumentList "install --id 9PLM9XGG6VKS -s msstore --accept-source-agreements --accept-package-agreements --silent" -WindowStyle Hidden
}
`;

const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & _
    WshShell.SpecialFolders("AllUsersStartup") & "\\InstallCodexForUser.ps1""", 0, False
`;

try {
  const psPath = path.join(startupFolder, "InstallCodexForUser.ps1");
  const vbsPath = path.join(startupFolder, "InstallCodexLauncher.vbs");

  fs.writeFileSync(psPath, psScriptContent, 'utf8');
  console.log(`[成功] 已將安裝腳本寫入: \${psPath}`);

  fs.writeFileSync(vbsPath, vbsContent, 'utf8');
  console.log(`[成功] 已將啟動器寫入: \${vbsPath}`);

  console.log("\\n===================================================");
  console.log("部署成功！現在每個帳號在登入 Windows 時都會自動安裝 Codex。");
  console.log("===================================================");
} catch (err) {
  if (err.code === 'EACCES') {
    console.error("\\n[錯誤] 權限不足！請務必以「系統管理員身分」執行此命令。");
  } else {
    console.error(`\\n[錯誤] 發生異常: \${err.message}`);
  }
  process.exit(1);
}
