const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  firstSentence,
  indexToolDefs,
  isStubbed,
  missingRequired,
  revealedToolNames,
  schemaReveal,
  stubDefinition,
} = require('../../src/tools/tool-index');
const { TOOL_DEFS, HOT_TOOL_NAMES } = require('../../tools');
const { normalizeSettings, DEFAULT_SETTINGS } = require('../../settings');

const source = (file) => fs.readFileSync(path.join(__dirname, '..', '..', file), 'utf8');
const estimate = (value) => Math.round(JSON.stringify(value).length / 4);
const byName = (defs, name) => defs.find((def) => def.function.name === name);

const PDF = {
  type: 'function',
  function: {
    name: 'pdf_fill_form',
    description: "Set values on a PDF form's fields. Field names must match exactly, and a missing field is an error rather than a silent skip.",
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the working directory' },
        values: { type: 'object', description: 'Field name to value' },
        flatten: { type: 'boolean', description: 'Make the filled fields read-only' },
      },
      required: ['path', 'values'],
    },
  },
};

test('a summary keeps the sentence that picks the tool and drops the rest', () => {
  assert.equal(firstSentence(PDF.function.description), "Set values on a PDF form's fields.");
  assert.equal(firstSentence('No trailing period'), 'No trailing period');
  assert.equal(firstSentence(''), '');
});

test('a stub names the required arguments but not what they mean', () => {
  const stub = stubDefinition(PDF);
  assert.deepEqual(stub.function.parameters.required, ['path', 'values']);
  assert.deepEqual(stub.function.parameters.properties, {
    path: { type: 'string' },
    values: { type: 'object' },
  });
  // Optional arguments and every description are what the reveal is for.
  assert.equal(stub.function.parameters.properties.flatten, undefined);
  assert.doesNotMatch(JSON.stringify(stub), /relative to the working directory/);
  // Left open so a model that already knows an optional argument can pass it
  // without a round trip to read a schema it had guessed correctly.
  assert.equal(stub.function.parameters.additionalProperties, true);
  assert.ok(estimate(stub) < estimate(PDF), 'a stub must be smaller than the definition it stands for');
});

test('hot tools keep their full schema and the rest are abbreviated', () => {
  const hot = new Set(HOT_TOOL_NAMES);
  const indexed = indexToolDefs(TOOL_DEFS, { hot, revealed: new Set() });

  assert.equal(indexed.length, TOOL_DEFS.length, 'no tool may be dropped from the payload');
  assert.deepEqual(byName(indexed, 'read_file'), byName(TOOL_DEFS, 'read_file'));
  assert.notDeepEqual(byName(indexed, 'pdf_fill_form'), byName(TOOL_DEFS, 'pdf_fill_form'));
  assert.ok(estimate(indexed) < estimate(TOOL_DEFS) * 0.75,
    `abbreviating must be a real saving (was ${estimate(indexed)} of ${estimate(TOOL_DEFS)})`);
});

test('every hot tool is a tool that actually exists', () => {
  const names = new Set(TOOL_DEFS.map((def) => def.function.name));
  assert.deepEqual(HOT_TOOL_NAMES.filter((name) => !names.has(name)), []);
});

test('a tool already called in this conversation stops being abbreviated', () => {
  const conversation = [
    { role: 'user', content: 'fill the form' },
    { role: 'assistant', content: '', tool_calls: [{ function: { name: 'pdf_fill_form', arguments: '{}' } }] },
  ];
  const revealed = revealedToolNames(conversation);
  assert.ok(revealed.has('pdf_fill_form'));

  const hot = new Set(HOT_TOOL_NAMES);
  const indexed = indexToolDefs(TOOL_DEFS, { hot, revealed });
  assert.deepEqual(byName(indexed, 'pdf_fill_form'), byName(TOOL_DEFS, 'pdf_fill_form'));
  assert.equal(isStubbed(PDF, { hot, revealed }), false);
});

test('a call is only interrupted when it is actually missing an argument', () => {
  assert.deepEqual(missingRequired(PDF, { path: 'a.pdf', values: {} }), []);
  assert.deepEqual(missingRequired(PDF, { path: 'a.pdf' }), ['values']);
  assert.deepEqual(missingRequired(PDF, {}), ['path', 'values']);
  assert.deepEqual(missingRequired(PDF, { path: '', values: {} }), ['path']);
  // A guess that happens to be right runs as it is — no round trip.
  assert.deepEqual(missingRequired(PDF, { path: 'a.pdf', values: {}, flatten: true }), []);
});

test('the reveal hands back the whole schema and says nothing ran', () => {
  const revealed = schemaReveal(PDF);
  assert.match(revealed, /nothing has run yet/);
  assert.match(revealed, /Call it again/);
  assert.match(revealed, /relative to the working directory/, 'the full descriptions are the point of the reveal');
  assert.match(revealed, /flatten/, 'optional arguments must come back too');
});

test('the tool payload is abbreviated only where it pays for itself', () => {
  const main = source('main.js');
  // Both the agent turn and the context inspector go through activeToolDefs, so
  // the inspector cannot report a payload different from the one being sent.
  assert.match(main, /function activeToolDefs\(chatMode, onlineResearch, model = runtimeSettings\.lastModel, \{ abbreviate = true \} = \{\}\)/);
  assert.match(main, /const contextLength = await effectiveContext\(model\);\n\s*\/\/ external MCP tools go for all\n\s*const agentTools = activeToolDefs\(chatMode, onlineResearch, model\);/,
    'the window must be resolved before the payload that depends on it');
  // The reveal needs the schema the stub discarded.
  assert.match(main, /activeToolDefs\(chatMode, onlineResearch, model, \{ abbreviate: false \}\)/);
  assert.match(main, /stubbedNames\.has\(name\) && fullToolDefs\.has\(name\)/);
  assert.match(main, /result = schemaReveal\(fullToolDefs\.get\(name\)\)/);
});

test('an abbreviated tool called without its arguments is answered, not refused', () => {
  const main = source('main.js');
  const branch = main.slice(main.indexOf('} else if (stubbedNames.has(name)'), main.indexOf('} else if (stopRequested)'));
  assert.doesNotMatch(branch, /denied: true/, 'a reveal is a tool result, not a denial');
  assert.doesNotMatch(branch, /result = `Error/);
});

test('toolIndex is a three-way setting that falls back to auto', () => {
  assert.equal(DEFAULT_SETTINGS.toolIndex, 'auto');
  assert.equal(normalizeSettings({ toolIndex: 'off' }).toolIndex, 'off');
  assert.equal(normalizeSettings({ toolIndex: 'on' }).toolIndex, 'on');
  assert.equal(normalizeSettings({ toolIndex: 'sometimes' }).toolIndex, 'auto');
  assert.equal(normalizeSettings({}).toolIndex, 'auto');
});
