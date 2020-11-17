import path from 'path';
import os from 'os';
import fs from 'fs';
import child_process from 'child_process';
import pid from './node-win-pid/index.js';
import stallUntilThrow from './stallUntilThrow.js';
import stallUntilReturn from './stallUntilReturn.js';
import parse from './parse.js';

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
      try {
        await fs.promises.rm(directoryPath, { recursive: true });
      }
      catch (error) {
        throw new Error('Failed to delete stray temporary directory');
      }
    }
  }
  catch (error) {
    // Rethrow error unless it is ENOENT indicating the directory doesn't exist
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  await fs.promises.mkdir(directoryPath);

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

  const execFilePath = path.join(directoryPath, directoryName) + '_exec.ps1';
  await fs.promises.writeFile(execFilePath, command);

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

  /** @type {string} */
  let _transcript;
  try {
    // TODO: Figure out how to run this with no window, `{ windowsHide: true }` doesn't do it
    // TODO: Look into the Windows API to see if we can hide by PID/handle
    // Note that this works due to Windows Sandbox being a single-instance process
    const { pid: windowsSandboxPid } = child_process.exec(`windowssandbox ${wsbFilePath}`);
    const windowsSandboxClientPid = await pid('WindowsSandboxClient.exe');

    // Monitor a `*.done` file creation signalling the script completion
    await new Promise(resolve => {
      // TODO: Find out if `Stop-Computer` could be used without WSB showing warning
      const watcher = fs.watch(directoryPath, async (_event, filename) => {
        if (filename === directoryName + '.done') {
          watcher.close();
          resolve();
        }
      });
    });

    // Kill Windows Sandbox as soon as we notice the `*.done` file was created
    process.kill(windowsSandboxPid);
    process.kill(windowsSandboxClientPid);

    // Stall until both processes are killed and release the temporary directory 
    await stallUntilThrow(() => pid('WindowsSandbox.exe', false), 10);
    await stallUntilThrow(() => pid('WindowsSandboxClient.exe', false), 10);

    // Load up the transcript now that it is fully flushed to the disk
    _transcript = await fs.promises.readFile(path.join(directoryPath, directoryName) + '.log', 'utf-8');
  }

  // Ensure the temporary directory is deleted no matter what to avoid bad state
  finally {
    await stallUntilReturn(() => fs.promises.rm(directoryPath, { recursive: true }));
  }

  // Recognize known error response format the transcript to std I/O streams
  const transcript = await parse(_transcript);
  const regex = /^PS>TerminatingError\(\): "(?<message>.*?)"$/;
  const match = transcript.data.length === 1 && regex.exec(transcript.data[0]);

  // Switch the response to either stdout or stderr based on recognized error
  const stdout = !match ? transcript.data.join('\n') : '';
  const stderr = match ? match.groups.message : '';
  const exitCode = match ? 1 : 0;

  // Return the `transcript` object as a whole for the purposes of debugging
  return { stdout, stderr, exitCode, transcript };
}
