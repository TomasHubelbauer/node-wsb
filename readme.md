# Node Windows Sandbox

This library allows running PowerShell scripts in Windows Sandbox.

## Installation

`git submodule add https://github.com/tomashubelbauer/node-wsb`

To update:

```sh
cd node-wsb
git pull
cd ..
```

## Usage

```js
import wsb from './node-wsb/index.js';

console.log(await wsb('echo "Hello, World!"'));
```

The return value is an object:

- `stdout` (`string`): the output value in case of success
- `stderr` (`string`): the output value in case of failure
- `exitCode` (`number`): 0 for success, 1 for failure
- `transcript` (`object`):
  - `startTime` (`string`): the transcript start instant in `yyyymmddhhmmss`
  - `endTime` (`string`): the transcript end instant in `yyyymmddhhmmss`
  - `meta` (`object`): an object made of transcript metadata key-value pairs
  - `data`: (`string[]`) an array of lines written to the transcript

## Development

Run tests using `npm test`.

### To-Do

#### Address code to-do comments

Use [`todo`](https://github.com/tomashubelbauer/todo).

#### Finalize the `wait` argument logic - wait or bail based on its value

#### Add a "simulation" mode option which falls back to PowerShell direct

This would be used in the CI or when the user doesn't want to / can't enable WSB
on their machine.


#### Consider adding a Docker backend for non-Windows and CI environments maybe

Perhaps it should be a separate package though.

#### Look into using PowerShell remoting for communicating with the sandbox

I think we could find the sandbox' IP address and connect to it using PowerShell
remoting and run the commands that way. We might need to turn it on first.
