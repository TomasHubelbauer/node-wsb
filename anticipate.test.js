import anticipate from './anticipate.js';
import assert from 'assert';

void async function () {
  // No waiting, success
  assert.strictEqual(await anticipate(async () => true), true);

  // No waiting, failure allowed to retry, then success
  let hit = false;
  assert.strictEqual(await anticipate(async () => { if (hit) { return true; } else { hit = true; throw new Error('Try again'); } }, error => true), true);
}()
