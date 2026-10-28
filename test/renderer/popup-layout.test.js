const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// The top bar sits inside the workspace beside the sidebar, so dialogs dim the
// whole window rather than starting below a full-width header.
test('dialogs cover the whole window', () => {
  const css = read('renderer/style.css');

  for (const id of ['overlay', 'confirm-modal', 'settings-modal']) {
    assert.match(
      css,
      new RegExp(`#${id} \\{[\\s\\S]*?inset: 0;`),
      `${id} must cover the window`
    );
  }

  assert.doesNotMatch(css, /--topbar-height/);
  assert.match(css, /#settings-form \{[\s\S]*?max-height: 100%;/);
  assert.match(css, /#overlay-box \{[\s\S]*?max-height: 100%;/);
});
