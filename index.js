import path from 'path';
import os from 'os';
import fs from 'fs';
import child_process from 'child_process';
import pid from './node-win-pid/index.js';

// TODO: Figure out the dangling promise/callback that prevents Node from ending
// (it doesn't seem to be either of the processes according to Task Manager)
// TODO: Add options (share pwd (r/w or r/o), add other shares)
// TODO: Allow running a PS1 file directly instead of the PowerShell code string
export default async function (/** @type {string} */ command) {
  const directoryName = 'wsb';
  const directoryPath = path.join(os.tmpdir(), directoryName);
  await fs.promises.rm(directoryPath, { recursive: true, force: true });
  await fs.promises.mkdir(directoryPath);
  await fs.promises.writeFile(path.join(directoryPath, directoryName) + '.ps1', command);

  const tempDirectoryPath = 'C:\\Users\\WDAGUtilityAccount\\AppData\\Local\\Temp\\' + directoryName;

  const logonCommand = [
    // Start PowerShell using its full path because there is not %PATH% here
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    // Remove execution policy to be able to run the script file we'll make
    '-executionpolicy unrestricted',
    // Put together the bootstrap command to run the script file later
    '-command "',
    // Start transcript that will be used as a return value when done executing
    `Start-Transcript ${path.join(tempDirectoryPath, directoryName)}.log;`,
    // Execute the command from the script file we've created with it
    // TODO: Wrap this in a try-catch so that the `*.done` file is written for sure
    // (not sure if it would be if the inner script did e.g.: `$ErrorActionPreference = "Stop"`)
    // Do not use the `&` operator because Windows Sandbox won't accept it
    //`powershell -file ${path.join(tempDirectoryPath, directoryName)}.ps1 -wait;`,
    // TODO: Make this work using the above, this won't support multi-line
    command + ';',
    // Touch the `*.done` file to signal the script has finished processing
    `$null > ${path.join(tempDirectoryPath, directoryName)}.done`,
    // End the string literal containing the bootstrap script we're running
    '"',
  ].join(' ');

  // Note that `%tmp%` can not be used in `SandboxFolder` path values
  // Note that Windows-style back-slashes need to be used for path separators
  // See also https://github.com/damienvanrobaeys/Windows_Sandbox_Editor
  const wsbFilePath = path.join(directoryPath, directoryName) + '.wsb';
  await fs.promises.writeFile(wsbFilePath, `
<Configuration>
  <MappedFolders>
    <MappedFolder>
      <HostFolder>${directoryPath}</HostFolder>
      <SandboxFolder>${tempDirectoryPath}</SandboxFolder>
    </MappedFolder>
  </MappedFolders>
  <LogonCommand>
    <Command>${logonCommand}</Command>
  </LogonCommand>
</Configuration>
`);

  // TODO: Figure out how to run this with no window being shown and stealing focus
  // Note that this relies on Windows Sandbox being a singleton process as enforced by Windows
  const { pid: windowsSandboxPid } = child_process.exec(`windowssandbox ${wsbFilePath}`);
  const windowsSandboxClientPid = await pid('WindowsSandboxClient.exe');

  await new Promise(resolve => {
    // Kill Windows Sandbox as soon as we notice the `*.done` file was created
    // TODO: Find out if `Stop-Computer` could be used without WSB showing warning
    let done;
    fs.watch(directoryPath, (_event, filename) => {
      if (filename === directoryName + '.done' && !done) {
        done = true;
        process.kill(windowsSandboxPid);
        process.kill(windowsSandboxClientPid);
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
