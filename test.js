import wsb from './index.js';
import assert from 'assert';

void async function () {
  assert.strictEqual(await wsb('echo "Hello, World!"'), 'Hello, World!\r\n');

  // TODO: Make this actually work by parsing out the error message for stderr
  assert.strictEqual(await wsb('throw "Error!"'), '');
}()
