const test = require('node:test');
const assert = require('node:assert/strict');
const { filterConversations } = require('../../renderer/features/chat-layout');

const chats = [
  { id: 'one', title: 'Fix café menu', cwd: '/projects/website', model: 'qwen3:8b' },
  { id: 'two', title: 'Explain the quotient rule', mode: 'chat', model: 'Brittain 4' },
  { id: 'three', cwd: '/projects/cli', model: 'qwen3-coder:30b' },
];

test('conversation search finds titles and project or model names without case or accent sensitivity', () => {
  assert.deepEqual(filterConversations(chats, 'CAFE WEBSITE').map((chat) => chat.id), ['one']);
  assert.deepEqual(filterConversations(chats, 'brittain quotient').map((chat) => chat.id), ['two']);
  assert.deepEqual(filterConversations(chats, 'cli coder').map((chat) => chat.id), ['three']);
});

test('clearing search restores all chats and unmatched searches stay empty', () => {
  assert.deepEqual(filterConversations(chats, '  '), chats);
  assert.deepEqual(filterConversations(chats, 'unrelated'), []);
  assert.deepEqual(filterConversations(chats, 'cafe quotient'), []);
});
