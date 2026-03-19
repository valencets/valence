# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

Only the latest published release receives security fixes.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report vulnerabilities through one of:

1. **GitHub Security Advisories** (preferred): [Report a vulnerability](https://github.com/valencets/valence/security/advisories/new)
2. **Email**: security@valencets.dev

### What to include

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Potential impact

### What to expect

- **Acknowledgment** within 48 hours
- **Initial assessment** within 1 week
- **Fix timeline** communicated after assessment
- **Credit** in the release notes (unless you prefer anonymity)

## Security Best Practices for Users

- Keep Valence and its dependencies up to date
- Never commit `.env` files or database credentials to version control
- Use environment variables for all secrets
- Enable PostgreSQL SSL in production
