const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Code.gs is a plain script; load its pure helpers into a sandbox (Apps Script globals are not needed for them).
const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'apps-script', 'Code.gs'), 'utf8');
const sandbox = {};
vm.runInNewContext(source, sandbox);

const valid = { name: ' 민수 ', score: 530, moves: 12, remaining: 0, status: 'cleared' };

test('validateSubmission_ accepts a good record and cleans the name', () => {
    assert.deepEqual({ ...sandbox.validateSubmission_(valid) }, { name: '민수', score: 530, moves: 12, remaining: 0, status: 'cleared' });
    assert.equal(sandbox.validateSubmission_({ ...valid, name: '' }).name, '익명');
    assert.equal(sandbox.validateSubmission_({ ...valid, name: 'x'.repeat(40) }).name.length, 12);
});

test('validateSubmission_ rejects bad numbers, statuses and inconsistent boards', () => {
    for (const bad of [
        { score: -1 }, { score: 1.5 }, { score: '530' }, { score: 1e9 }, { moves: -1 }, { remaining: 82 },
        { status: 'won' }, { status: 'cleared', remaining: 3 }, { status: 'gameover', remaining: 0 }
    ]) {
        assert.equal(sandbox.validateSubmission_({ ...valid, ...bad }), null, JSON.stringify(bad));
    }
    assert.ok(sandbox.validateSubmission_({ ...valid, status: 'gameover', remaining: 81 }));
});

test('topEntries_ orders by score, moves, newest and keeps 20', () => {
    const row = (timestamp, name, score, moves) => [timestamp, name, score, moves, 0, 'cleared'];
    const rows = [row(1, 'a', 100, 5), row(2, 'b', 200, 9), row(3, 'c', 200, 4), row(4, 'd', 100, 5), ['bad']];
    assert.deepEqual(sandbox.topEntries_(rows).map(e => e.name), ['c', 'b', 'd', 'a']);

    const many = Array.from({ length: 30 }, (_, i) => row(i + 1, `p${i}`, i, 1));
    assert.equal(sandbox.topEntries_(many).length, 20);
    assert.equal(sandbox.topEntries_(many)[0].name, 'p29');
});
