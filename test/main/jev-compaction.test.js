const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyStoredDecisions,
  collectToolPairs,
  compactWithJev,
  emergencyDecisions,
  scoreConversation,
} = require('../../src/main/jev-compaction');

function toolTurn(id, name, args, result) {
  return [
    {
      role: 'assistant',
      content: '',
      tool_calls: [{ id, type: 'function', function: { name, arguments: args } }],
    },
    { role: 'tool', tool_name: name, tool_call_id: id, content: result },
  ];
}

function fakeJev(answers) {
  return async (_url, request) => {
    const body = JSON.parse(request.body);
    assert.equal(body.model, 'jev-test');
    assert.ok(body.state.active_request);
    assert.ok(Object.keys(body.questions).length > 0);
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ answers, usage: { input_tokens: 123 } }),
    };
  };
}

test('pairs use stable tool-call ids and keep same-name calls distinct', () => {
  const messages = [
    { role: 'user', content: 'Inspect both files.' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        { id: 'call-a', function: { name: 'read_file', arguments: { path: 'a.js' } } },
        { id: 'call-b', function: { name: 'read_file', arguments: { path: 'b.js' } } },
      ],
    },
    { role: 'tool', tool_name: 'read_file', tool_call_id: 'call-b', content: 'B' },
    { role: 'tool', tool_name: 'read_file', tool_call_id: 'call-a', content: 'A' },
  ];
  const pairs = collectToolPairs(messages);
  assert.deepEqual(pairs.map((pair) => [pair.callId, pair.result]), [['call-b', 'B'], ['call-a', 'A']]);
});

test('Jev drops reproducible reads and only shortens mutation results', async () => {
  const readResult = 'old file body '.repeat(300);
  const writeResult = 'write details '.repeat(300);
  const messages = [
    { role: 'user', content: 'Update the parser.' },
    ...toolTurn('read-1', 'read_file', { path: 'parser.js' }, readResult),
    ...toolTurn('write-1', 'write_file', { path: 'parser.js', content: 'new' }, writeResult),
  ];

  const result = await compactWithJev(messages, {
    endpoint: 'https://jev.test/v1/systemone',
    apiKey: 'secret',
    model: 'jev-test',
    preserveRecentPairs: 0,
    fetcher: fakeJev({
      call_0: { noul: 0.1 },
      result_0: { noul: 0.1 },
      call_1: { noul: 0.1 },
      result_1: { noul: 0.1 },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.callsDropped, 1);
  assert.equal(result.resultsShortened, 1);
  assert.equal(result.messages.some((message) => message.tool_call_id === 'read-1'), false);
  assert.equal(result.messages.some((message) => message.tool_call_id === 'write-1'), true);
  assert.match(result.messages.find((message) => message.tool_call_id === 'write-1').content, /Jev compaction shortened/);
  assert.deepEqual(applyStoredDecisions(messages).sourceIndices, [0, 3, 4],
    'the context inspector can map the selected view back to saved messages');
  assert.equal(messages.find((message) => message.tool_call_id === 'read-1').content, readResult,
    'the full saved transcript must stay intact');
  assert.equal(messages.find((message) => message.tool_call_id === 'write-1').content, writeResult);
});

test('missing answers and errors stay verbatim', async () => {
  const errorText = 'Error: exact failure at parser.js:42';
  const messages = [
    { role: 'user', content: 'Fix the parser.' },
    ...toolTurn('read-1', 'read_file', { path: 'parser.js' }, 'body'),
    ...toolTurn('read-2', 'read_file', { path: 'missing.js' }, errorText),
  ];
  await scoreConversation(messages, {
    endpoint: 'https://jev.test/v1/systemone',
    apiKey: 'secret',
    model: 'jev-test',
    preserveRecentPairs: 0,
    fetcher: fakeJev({ call_0: { noul: 0.1 } }),
  });
  const view = applyStoredDecisions(messages).messages;
  assert.equal(view.some((message) => message.tool_call_id === 'read-1'), true);
  assert.equal(view.find((message) => message.tool_call_id === 'read-2').content, errorText);
});

test('emergency pruning can reduce completed reads inside one active user turn', () => {
  const messages = [
    { role: 'user', content: 'One long active request.' },
    ...toolTurn('read-1', 'read_file', { path: 'a.js' }, 'A'.repeat(8000)),
    ...toolTurn('read-2', 'read_file', { path: 'b.js' }, 'B'.repeat(8000)),
    ...toolTurn('read-3', 'read_file', { path: 'c.js' }, 'C'.repeat(8000)),
  ];
  const before = JSON.stringify(messages).length;
  const changed = emergencyDecisions(messages, { targetTokens: 500, preserveRecentPairs: 1 });
  const view = applyStoredDecisions(messages).messages;
  assert.equal(changed, 2);
  assert.ok(JSON.stringify(view).length < before / 2);
  assert.equal(view.some((message) => message.tool_call_id === 'read-3'), true,
    'the newest completed pair stays exact');
  assert.equal(messages.find((message) => message.tool_call_id === 'read-1').content.length, 8000,
    'emergency pruning must remain reversible');
});

test('stored decisions are ignored after the call or result changes', () => {
  const messages = [
    { role: 'user', content: 'Inspect.' },
    ...toolTurn('read-1', 'read_file', { path: 'a.js' }, 'old'),
  ];
  emergencyDecisions(messages, { targetTokens: 1, preserveRecentPairs: 0 });
  messages[2].content = 'new result';
  const view = applyStoredDecisions(messages).messages;
  assert.equal(view.some((message) => message.tool_call_id === 'read-1'), true);
});
