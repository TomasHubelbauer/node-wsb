import assert from 'assert';

const delimiter = '*'.repeat(22);

export default async function parse(/** @type {string} */ transcript) {
  const lines = transcript.split(/\r\n/g);
  let state = '';
  let startTime;
  let endTime;
  const meta = {};
  const data = [];
  for (const line of lines) {
    switch (state) {
      case '': {
        assert.strictEqual(line, '\ufeff' /* Unicode byte order mark */ + delimiter);
        state = 'start-banner';
        break;
      }
      case 'start-banner': {
        assert.strictEqual(line, 'Windows PowerShell transcript start');
        state = 'start-time';
        break;
      }
      case 'start-time': {
        const regex = /^Start time: (?<value>\d+)$/;
        assert.match(line, regex);
        const match = regex.exec(line);
        startTime = (match.groups.value);
        state = 'meta';
        break;
      }
      case 'meta': {
        if (line === delimiter) {
          state = 'transcript';
          break;
        }

        const regex = /^(?<key>.*?): (?<value>.*?)$/;
        assert.match(line, regex);
        const match = regex.exec(line);
        meta[match.groups.key] = match.groups.value;
        break;
      }
      case 'transcript': {
        assert.match(line, /^Transcript started, output file is .*?$/);
        state = 'data';
        break;
      }
      case 'data': {
        if (line === delimiter) {
          state = 'end-banner';
          break;
        }

        data.push(line);
        break;
      }
      case 'end-banner': {
        assert.strictEqual(line, 'Windows PowerShell transcript end');
        state = 'end-time';
        break;
      }
      case 'end-time': {
        const regex = /^End time: (?<value>\d+)$/;
        assert.match(line, regex);
        const match = regex.exec(line);
        endTime = (match.groups.value);
        state = 'fin';
        break;
      }
      case 'fin': {
        assert.strictEqual(line, delimiter);
        state = 'eof';
        break;
      }
      case 'eof': {
        assert.strictEqual(line, '');
        break;
      }
      default: {
        throw new Error('TODO');
      }
    }
  }

  return { startTime, endTime, meta, data };
}
