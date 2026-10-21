# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 4.2.x   | ✅ Yes     |
| < 4.2   | ❌ No      |

## Reporting a Vulnerability

**Do NOT open a public GitHub issue for security vulnerabilities.**

Use [GitHub's private security advisory form](https://github.com/UdaySharmaGitHub/Agentic-cli/security/advisories/new) to report privately.

### What to include

- Affected version
- Description of the vulnerability
- Steps to reproduce
- Suggested fix (if any)

### Response SLA

- Acknowledgement within **5 business days**
- Fix target within **30 days** for critical issues

## Security Notes for Contributors

- **Never commit API keys.** `GEMINI_API_KEY`, `BRAVE_API_KEY`, and `TAVILY_API_KEY` must stay in `.env` only.
- Treat `run_command` input, file paths, and web search results as **untrusted data**.
- The safety layer in `src/tools/shellTools.ts` must not be weakened without a security review.
