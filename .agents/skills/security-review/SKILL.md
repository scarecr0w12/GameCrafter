---
name: security-review
description: "Review game or authoring-platform trust boundaries, authentication, authorization, untrusted assets/messages, secrets, and abuse risks. Use for scoped defensive security assessment; distinguish network transports and verify candidate findings before reporting vulnerabilities."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Security review

Identify evidence-backed security failures in the authorized scope and propose testable, proportionate defenses.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Repository/feature scope, deployment topology, actors, data, and permitted review actions.
- Transport/protocol, local versus public access, authentication, and persistence boundaries.
- Existing policy, relevant changed code, logs, tests, and known reports.

## Procedure

### 1. Map trust boundaries

- Identify untrusted players, plugins, assets, remote tools, and local processes.
- Trace how their input reaches privileged state, files, commands, or network services.

### 2. Match transport context

- Distinguish Unix sockets/named pipes, HTTP/WebSocket, engine UDP, and dedicated-server transport.
- Apply origin/cookie guidance to browser WebSockets, not indiscriminately to all transports.

### 3. Inspect identity and authority

- Check authentication and authorization for individual operations and objects.
- For game state, inspect server authority and validation of client-reported results.

### 4. Inspect input and resource bounds

- Trace parsing, schemas, sizes, rates, timeouts, retries, and object lifetimes.
- Check malformed input does not cross into command execution or uncontrolled allocation.

### 5. Inspect secrets and sessions

- Check storage, logging, redaction, expiry, logout, and long-lived connections.
- Use available test credentials; do not expose real tokens in reports or shell output.

### 6. Validate candidate findings

- Build a minimal local proof within authorized scope and inspect existing mitigating controls.
- Separate reproducible vulnerabilities from hypothetical hardening suggestions.

### 7. Recommend a focused fix

- Specify enforcement location, failure behavior, and regression scenario.
- Avoid claims that encryption alone solves authorization or gameplay cheating.

### 8. Deliver a calibrated review

- Report affected path, prerequisite, impact, evidence, and remaining uncertainty.
- Use the repository’s security skills for detailed scan/fix workflows when their trigger applies.

## Deliverables

- Trust-boundary map and scoped findings.
- Reproduction/evidence, mitigations, and severity rationale.
- Focused fixes or hardening proposals with verification scenarios.

## Completion review

- Each finding has a concrete path and attacker prerequisite.
- Transport-specific guidance is applied only to its relevant context.
- Existing controls and negative evidence are considered.
- Verified findings, unverified candidates, and hardening proposals are distinct.

## Gotchas

- A malicious local process and a remote unauthenticated player have different prerequisites.
- Browser Origin headers are not identities for arbitrary native clients.
- Do not run a security proof against public services without explicit authorization.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that PlayWeld has executed them.
Last researched: 2026-10-01.

- [WebSocket-specific defenses and tests](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).
- [Gameplay authority and untrusted client input](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html).
