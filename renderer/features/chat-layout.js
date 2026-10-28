(function attachChatLayout(global) {
  function searchText(value) {
    return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function filterConversations(chats, query) {
    const terms = searchText(query).trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return chats;
    return chats.filter((chat) => {
      const text = searchText([chat.title, chat.cwd, chat.model].filter(Boolean).join(' '));
      return terms.every((term) => text.includes(term));
    });
  }

  const api = { filterConversations };
  global.ChatLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
