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

console.log(await wsb('echo "Hello, World!"')); // "Hello, World!\r\n"
```

## Development

Run tests using `npm test`.

### To-Do

#### Address code to-do comments

Use [`todo`](https://github.com/tomashubelbauer/todo).

#### Recognize the transcript end value

- `PS>TerminatingError(): "Error time"` if `throw`
- `PS>$Global:1` or something was there at some point too
- nothing (`****…`) if the last command is empty line

Might need to wait for the processes to be really dead and the transcript fully
flushed before I can access its final content.

#### Finalize the `wait` argument logic - wait or bail based on its value

#### Add a "simulation" mode option which falls back to PowerShell direct

This would be used in the CI or when the user doesn't want to / can't enable WSB
on their machine.


#### Consider adding a Docker backend for non-Windows and CI environments maybe

Perhaps it should be a separate package though.
