import fs from 'fs';
import path from 'path';

const action = process.argv[2];

if (action === 'write') {
  const targetFile = process.argv[3];
  const contentFile = process.argv[4];
  
  if (!targetFile || !contentFile) {
    console.error('Usage: node saveHelper.js write <targetFile> <contentFile>');
    process.exit(1);
  }
  
  try {
    const content = fs.readFileSync(contentFile, 'utf8');
    safeWriteWithBOM(targetFile, content);
    console.log(`Successfully wrote ${targetFile} with UTF-8 BOM.`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
} else if (action === 'updateLog') {
  const version = process.argv[3];
  const date = process.argv[4];
  const changes = process.argv[5];
  
  if (!version || !date || !changes) {
    console.error('Usage: node saveHelper.js updateLog <version> <date> <changes>');
    process.exit(1);
  }
  
  const logFile = path.resolve('modify.log');
  updateModifyLog(logFile, version, date, changes);
} else {
  console.error('Unknown action. Use "write" or "updateLog".');
  process.exit(1);
}

// Function to write a file safely with UTF-8 BOM
function safeWriteWithBOM(filePath, content) {
  const resolvedPath = path.resolve(filePath);
  const backupPath = `${resolvedPath}.bak`;
  
  // 1. If file exists, create a backup
  let backupCreated = false;
  if (fs.existsSync(resolvedPath)) {
    try {
      fs.copyFileSync(resolvedPath, backupPath);
      backupCreated = true;
    } catch (err) {
      throw new Error(`Failed to create backup: ${err.message}`);
    }
  }
  
  try {
    // 2. Prepare UTF-8 BOM buffer
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
    const contentBuffer = Buffer.from(content, 'utf8');
    const finalBuffer = Buffer.concat([bom, contentBuffer]);
    
    // 3. Write to file
    fs.writeFileSync(resolvedPath, finalBuffer);
    
    // 4. Double check the file size and BOM
    if (!fs.existsSync(resolvedPath)) {
      throw new Error('File does not exist after writing.');
    }
    
    const stats = fs.statSync(resolvedPath);
    if (stats.size === 0) {
      throw new Error('File is 0 bytes after writing.');
    }
    
    const readFd = fs.openSync(resolvedPath, 'r');
    const checkBuffer = Buffer.alloc(3);
    fs.readSync(readFd, checkBuffer, 0, 3, 0);
    fs.closeSync(readFd);
    
    if (checkBuffer[0] !== 0xEF || checkBuffer[1] !== 0xBB || checkBuffer[2] !== 0xBF) {
      throw new Error('Verification failed: Written file is missing UTF-8 BOM.');
    }
    
    // Success - delete backup
    if (backupCreated && fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  } catch (err) {
    // Restore from backup on failure
    if (backupCreated && fs.existsSync(backupPath)) {
      try {
        fs.copyFileSync(backupPath, resolvedPath);
        fs.unlinkSync(backupPath);
        console.log(`Restored original file from backup due to write error.`);
      } catch (restoreErr) {
        console.error(`Critical error: Failed to restore backup! ${restoreErr.message}`);
      }
    }
    throw err;
  }
}

// Function to update modify.log with newest entry at the top
function updateModifyLog(logFilePath, version, date, changes) {
  let existingContent = '';
  if (fs.existsSync(logFilePath)) {
    // Read and remove BOM if present
    const rawContent = fs.readFileSync(logFilePath);
    if (rawContent[0] === 0xEF && rawContent[1] === 0xBB && rawContent[2] === 0xBF) {
      existingContent = rawContent.slice(3).toString('utf8');
    } else {
      existingContent = rawContent.toString('utf8');
    }
  }
  
  // Format the new log entry
  const newEntry = `===================================================
版本: ${version}
製作日期: ${date}
本次版本的變更:
${changes.split('\\n').map(line => `- ${line}`).join('\n')}
===================================================\n\n`;

  const updatedContent = newEntry + existingContent;
  
  try {
    safeWriteWithBOM(logFilePath, updatedContent);
    console.log(`Successfully updated modify.log with version ${version}.`);
  } catch (err) {
    console.error(`Failed to update modify.log: ${err.message}`);
    process.exit(1);
  }
}
