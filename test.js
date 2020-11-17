import wsb from './index.js';
import assert from 'assert';

void async function () {
  const helloWorld = await wsb('echo "Hello, World!"');
  assert.deepStrictEqual(helloWorld.stdout, 'Hello, World!');
  assert.deepStrictEqual(helloWorld.stderr, '');
  assert.deepStrictEqual(helloWorld.exitCode, 0);

  const error = await wsb('throw "Error!"');
  assert.deepStrictEqual(error.stdout, '');
  assert.deepStrictEqual(error.stderr, 'Error!');
  assert.deepStrictEqual(error.exitCode, 1);
}()
