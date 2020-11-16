import path from 'path';
import os from 'os';
import fs from 'fs';
import child_process from 'child_process';
import pid from './node-win-pid/index.js';

// TODO: Add options (share pwd (r/w or r/o), add other shares)
// TODO: Allow running a PS1 file directly instead of the PowerShell code string
export default async function (/** @type {string} */ command) {
  const directoryName = 'wsb';
  const directoryPath = path.join(os.tmpdir(), directoryName);

  // TODO: Detect the folder existing and wait if so confifugred
  // TODO: Delete after the session run so it doesn't appear as running next time
  await fs.promises.rm(directoryPath, { recursive: true, force: true });
  await fs.promises.mkdir(directoryPath);

  const execFilePath = path.join(directoryPath, directoryName) + '_exec.ps1';
  await fs.promises.writeFile(execFilePath, command);

  const bootFilePath = path.join(directoryPath, directoryName) + '_boot.ps1';
  await fs.promises.writeFile(bootFilePath, `
Start-Transcript $Env:Temp/${directoryName}/${directoryName}.log
try {
  & $Env:Temp/${directoryName}/${directoryName}_exec.ps1
}
finally {
  $null > $Env:Temp/${directoryName}/${directoryName}.done
  exit
}
`);

  // Note that `%tmp%` can not be used in `SandboxFolder` path values
  // Note that Windows-style \ back-slashes need to be used for path separators
  // Use full `powershell.exe` path because this environment doesn't have %PATH%
  // Use `-executionpolicy unrestricted` otherwise we couldn't run the `-file`
  const wsbFilePath = path.join(directoryPath, directoryName) + '.wsb';
  await fs.promises.writeFile(wsbFilePath, `
<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>${directoryPath}</HostFolder>
      <SandboxFolder>C:\\Users\\WDAGUtilityAccount\\AppData\\Local\\Temp\\${directoryName}</SandboxFolder>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -executionpolicy unrestricted -file C:\\Users\\WDAGUtilityAccount\\AppData\\Local\\Temp\\${directoryName}\\${directoryName}_boot.ps1</Command>
  </LogonCommand>
</Configuration>
`);

  // TODO: Figure out how to run this with no window, `{ windowsHide: true }` doesn't do it
  // Note that this relies on Windows Sandbox being a singleton process as enforced by Windows
  const { pid: windowsSandboxPid } = child_process.exec(`windowssandbox ${wsbFilePath}`);
  const windowsSandboxClientPid = await pid('WindowsSandboxClient.exe');

  await new Promise(resolve => {
    // Kill Windows Sandbox as soon as we notice the `*.done` file was created
    // TODO: Find out if `Stop-Computer` could be used without WSB showing warning
    let done;
    const watcher = fs.watch(directoryPath, (_event, filename) => {
      if (filename === directoryName + '.done' && !done) {
        done = true;
        process.kill(windowsSandboxPid);
        process.kill(windowsSandboxClientPid);
        watcher.close();
        resolve();
      }
    });
  });

  const transcript = await fs.promises.readFile(path.join(directoryPath, directoryName) + '.log', 'utf-8');

  // TODO: Figure out why this doesn't work
  const regex = /^\*{22}\r?\n(?<meta>(.*?\r?\n)*?)\*{22}\r?\n.*?(?<data>(.*?\r?\n)*?)$/;

  // TODO: Extend the regex and use `End time` and `Start time` to parse out duration
  const match = regex.exec(transcript);

  const delimiter = '**********************\r\n';
  return transcript.slice(transcript.indexOf('\n', transcript.lastIndexOf(delimiter) + delimiter.length) + '\n'.length);
}
