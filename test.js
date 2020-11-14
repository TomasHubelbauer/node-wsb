import wsb from './index.js';

void async function () {
  console.log(await wsb('echo "Hello, World!"'));
}()
