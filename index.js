import path from 'path';
import os from 'os';
import fs from 'fs';
import child_process from 'child_process';
import pid from './node-win-pid/index.js';
import anticipate from './anticipate.js';

// TODO: Add options (share pwd (r/w or r/o), add other shares)
// TODO: Allow running a PS1 file by path instead of the PowerShell code string

/**
 * Runs a PowerShell command in the Windows Sandbox environment and returns its
 * standard I/O.
 * 
 * @param {string} command The PowerShell command to run. Can be multi-line.
 * @param {{ timeout: number; selfOnly: true; }} wait How to wait for another
 * instance of Windows Sandbox to finish if one is running. `undefined` means to
 * not wait and throw if another Windows Sandbox instance is running. `selfOnly`
 * means to wait only if the Windows Sandbox instance appears to be running due
 * to `node-wsb`, throw if it appears to be running due to the computer user.
 */
export default async function (command, wait = 'self') {
  const directoryName = 'wsb';
  const directoryPath = path.join(os.tmpdir(), directoryName);

  // Check if the temporary directory exists (and see if we need to wait or not)
  try {
    await fs.promises.access(directoryPath);

    // TODO: Split this into two checks potentially - does it have a benefit?
    // See if Windows Sandbox is really running or the directory is just stray
    try {
      await pid('WindowsSandbox.exe', false);
      await pid('WindowsSandboxClient.exe', false);

      // TODO: Implement this decision based on the `wait` argument value
      throw new Error('TODO: Wait or bail as Windows Sanbox is running');
    }
    catch (error) {
      // Delete the stray temporary directory as Windows Sandbox is not running
      await fs.promises.rm(directoryPath, { recursive: true });
    }
  }
  catch (error) {
    // Rethrow error unless it is ENOENT indicating the directory doesn't exist
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

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
  // Note that this works due to Windows Sandbox being a single-instance process
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

        // TODO: Stall until the processes are really dead - keep querying PIDs
        resolve();
      }
    });
  });

  const transcript = await fs.promises.readFile(path.join(directoryPath, directoryName) + '.log', 'utf-8');

  // Wait for the directory to be deletable (after WSB has let its handle go)
  // TODO: Wrap in `finally` to avoid inconsistency (dir but no WSB instance)
  await anticipate(() => fs.promises.rm(directoryPath, { recursive: true }), error => error.code === 'EBUSY' ? 'continue' : undefined, 10000, 100);

  // TODO: Figure out why this doesn't work
  const regex = /^\*{22}\r?\n(?<meta>(.*?\r?\n)*?)\*{22}\r?\n.*?(?<data>(.*?\r?\n)*?)$/;

  // TODO: Extend the regex and use `End time` and `Start time` to parse out duration
  const match = regex.exec(transcript);

  const delimiter = '**********************\r\n';

  // TODO: Return the full transcript for debugging and parse it for std I/O and exit code
  return transcript.slice(transcript.indexOf('\n', transcript.lastIndexOf(delimiter) + delimiter.length) + '\n'.length);
}
