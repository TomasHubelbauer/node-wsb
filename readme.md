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

## Development

Run tests using `npm test`.

### To-Do

#### Address code to-do comments

#### Recognize the transcript end value

- `PS>TerminatingError(): "Error time"` if `throw`
- `PS>$Global:1` or something was there at some point too
- nothing (`****…`) if the last command is empty line

#### Enqueue the execution if another WSB instance is already running

Think about recognizing this by the existence of the temp folder or just the
WSB process. If just the WSB process is running, but there is no folder, the
user is running it - should we still enqueue then? Maybe we can extend the API
to be able to configure this:

`wait`:
- `true` - wait for user WSB and this WSB
- `false` - throw if can't run WSB immediately
- `"except-user"` - wait only if this WSB is running, not if the user is running it
