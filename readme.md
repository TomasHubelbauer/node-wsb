# Node Windows Sandbox

This library allows running PowerShell scripts in Windows Sandbox.

## Installation

`git submodule add https://github.com/tomashubelbauer/node-wsb`

## Usage

```js
import wsb from './node-wsb/index.js';

console.log(await wsb('echo "Hello, World!"'));
```

## Development

Run tests using `npm test`.

### To-Do

#### Address code to-do comments
