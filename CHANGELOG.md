# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.2.0] - 2024-xx-xx

### Added

- TypeScript rewrite of the original Bash v4.1 script
- Native Gemini function calling via `@google/generative-ai` SDK
- Streaming responses with `ora` spinner
- Modular tool system (`readFile`, `writeFile`, `appendFile`, `modifyFile`, `listDir`, `runCommand`, `searchFiles`, `webSearch`)
- Interactive setup wizard via `@clack/prompts`
- Knowledge Base / role file support with auto-discovery from `roles based Workflow/`
- REPL commands: `/exit`, `/quit`, `/clear`, `/history`, `/status`, `/help`, `/raw`
- `--yolo` flag for auto-approving all actions
- Safety layer: blocked command patterns + protected paths
- Chat history persistence (`chat_history.json`)

[Unreleased]: https://github.com/UdaySharmaGitHub/Agentic-cli/compare/v4.2.0...HEAD
[4.2.0]: https://github.com/UdaySharmaGitHub/Agentic-cli/releases/tag/v4.2.0
