Brittain Code 1.5.0 adds a new chat interface, cloud provider support, unattended agent runs, and more PDF tools.

Changes since 1.4.6:

Interface

- Use the new chat layout. The sidebar holds New chat, conversation search, history, and Settings. The model picker and the Code/Chat switch sit at the top of the conversation. In Code mode, the project row shows the folder, Git actions, and the approval policy.
- Find chats by title, project folder, or model name with conversation search.
- Set THINK, web research, the approval policy, automatic branching, and review mode from **Run options** beside the message field. Context use and run details appear below it.
- Pick models from a searchable model list. Tool calls render as compact cards, and model reasoning appears in a collapsible Thoughts block.
- Drag files onto the window to attach them.

Providers and models

- Use an OpenAI-compatible cloud endpoint or a local Ollama endpoint. Provider settings include the endpoint and API key status, and switching provider type selects a matching provider.
- See cloud token costs from provider model prices. New cost records persist when you reopen a chat or restart the app.
- Use context windows up to 1M tokens. The served window is read from the provider, including `max_model_len`.
- Use THINK with cloud API models.

Autonomy and unattended runs

- Choose how much a run may do without asking with the approval policy: Supervised, Guarded, Trusted, or Autonomous. It replaces AUTO-APPROVE. Policies can set a spending limit, reach directories outside the project, and auto-approve online requests.
- Start unattended runs with `/agent`. Each run keeps a decision log. Calls that need a person are held for review instead of ending the run, and held calls suggest policy changes.
- Schedule runs with triggers and heartbeats, including project-scoped triggers.
- Keep triggers running after the window closes with the background daemon (`/agent daemon start` and `/agent daemon stop`).
- Confine shell commands in unattended runs with the macOS sandbox.
- Grant MCP trust per tool. Trust is tied to the server's command line.

Workspace, memory, and context

- Keep project memory and heartbeat configuration in the repository with `/workspace init`.
- Retain Chat memory between conversations.
- Read what a session did with `/ledger`. Session ledgers are saved on disk.
- Compaction keeps recent turns verbatim, builds its summary from the session ledger, validates the summary before discarding older turns, and summarizes oversized transcripts in parts. The current task is retained.
- Use Jev context compaction and tool schema indexing with Brittain 4 when a Jev API key is set.
- Keep large tool and MCP results within the context budget.

Chats, PDFs, and tools

- Continue chat runs while you view another conversation. Saved chats retain their title state, context, cost, and online settings.
- Read scanned PDFs and PDFs with unreadable text layers by rendering their pages. Models can view a rendered page.
- Use PDF tools to inspect and edit attached documents in Code and Chat mode. Successive edits accumulate in one output file.
- Use a local calculator in Chat mode.

Discord

- Reach the agent from Discord through the bridge built into the app. Each origin has its own conversation, and replies stream as the model writes them.
- Use the session commands compact, clear, usage, ledger, and memory from Discord.
- Continue Discord conversations after a restart. Queue handling, event routing, message order, stop controls, and daemon controls have fixes.

Release fixes:

- Generate chat titles after completed runs, including background runs. Failed title requests have a bounded retry count.
- Open web links in the system browser. Restrict window navigation, validate the sender of every renderer request, block remote page access to app commands, and block remote images in chat output.
- Save chat files through a temporary file and atomic replacement. Recover the history list from valid chat files if its index is damaged.
- Show dialogs above the whole window, including the top bar.
- Build macOS ARM64, macOS Intel, and Windows x64 packages on matching runners. Check native binaries and render a PDF from the packaged files before release.
- Update Electron to 43.6.0, Electron Builder to 26.15.3, and DOMPurify to 3.4.15.

Installation notes:

- Choose the macOS download that matches your processor, or the Windows x64 installer.
- macOS packages use an ad-hoc signature. macOS updates remain manual. Windows release builds support automatic updates.
- Local models require a running Ollama-compatible service. Cloud models require a configured endpoint and credentials.
- Existing chats without saved cost records cannot recover their earlier spend totals. Cost tracking continues from new requests.
- Online research remains a separate setting from the choice of inference provider.
- The macOS sandbox for unattended shell commands is not available on Windows.
