---
layout: default
title: Security and Vulnerability Reporting
description: >-
  How to report security vulnerabilities affecting joshternet.org and
  Joshternet projects.
permalink: /security/
---

# Security

Security reports are welcome.

Please do not disclose an unpatched vulnerability through a public GitHub issue.

## Report a vulnerability

For vulnerabilities affecting joshternet.org, the Joshternet specifications, or project infrastructure, email:

[security@joshternet.org](mailto:security@joshternet.org)

Please include enough information to reproduce and understand the issue, including the affected component, relevant URLs or versions, expected and observed behavior, reproduction steps, and the potential security impact.

Do not include unrelated personal information, credentials, private keys, access tokens, or other secrets unless they are specifically necessary to demonstrate the vulnerability.

## JoshBot vulnerabilities

Security vulnerabilities affecting JoshBot should be reported through [GitHub Private Vulnerability Reporting][joshbot-security].

Do not report an unpatched JoshBot vulnerability through a public bug or crawler report.

Ordinary software defects may use the [JoshBot bug report][joshbot-bug].

Unexpected crawling, robots behavior, or crawler traffic may use the [JoshBot crawler report][joshbot-crawler].

## Security contact discovery

joshternet.org also publishes a machine-readable security contact at:

```text
/.well-known/security.txt
```

The canonical security contact file is available at [/.well-known/security.txt](/.well-known/security.txt).

[joshbot-security]: https://github.com/joshternet/joshbot/security/advisories/new
[joshbot-bug]: https://github.com/joshternet/joshbot/issues/new?template=bug_report.yml
[joshbot-crawler]: https://github.com/joshternet/joshbot/issues/new?template=crawler_report.yml
