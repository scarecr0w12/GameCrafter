# Security review: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** Review a public WebSocket lobby command handler.

**Initial investigation:** Inspect handshake identity/origin and per-message authorization.

**Proposed action:** Test unauthorized room actions, malformed messages, flooding, and expiry locally.

**Expected handoff:** Validated findings with transport context, code pointers, and focused regression cases.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Trace identity and object authorization | Authorization: Denied request and preserved state. |
| Match controls to transport | Input/DoS: Bounded failure and no uncontrolled resource growth. |
| Exercise bounded parsing and abuse handling | Lifecycle: Further protected operations denied. |
| Validate session lifetime and false positives | False positive: Report reflects actual control behavior. |

## Detailed scenarios

### 1. Trace identity and object authorization

- For a local defensive fixture, create two users and two lobby rooms with distinct ownership.

- Inspect the path from authenticated message to room mutation and identify the object-level authorization check.

- Attempt user A’s action against user B’s room using permitted local test credentials.

- Inspect both the error response and authoritative state; a rejected UI interaction alone does not establish server enforcement.

- If the operation succeeds, record prerequisite, affected path, impact, and the existing control that was bypassed.

- Report a verified finding only after the reproduction; keep speculative missing-policy concerns as hardening proposals.

### 2. Match controls to transport

- For browser WebSockets, inspect origin allowlisting, credential/session behavior, and authorization after handshake.

- For native clients or engine UDP, inspect identity and authority without treating Origin as a general authentication mechanism.

- For Unix sockets/named pipes, inspect local connection permissions and authenticated request handling in the actual service.

- Test unauthorized access using the relevant local actor model; distinguish another local process from a remote internet player.

- Inspect transport encryption separately from gameplay validation; protected traffic can still carry unauthorized commands.

- Keep a topology/actor/control table and avoid copying WebSocket cookie guidance into unrelated transports.

### 3. Exercise bounded parsing and abuse handling

- Use the service’s configured limits to select a just-over-limit local message rather than inventing a universal payload size.

- Test malformed structured input, invalid enum/object values, repeated action requests, and disconnected-client retries.

- Trace input to parsing, schema validation, allocation, queues, and privileged execution; inspect where bounds are enforced.

- Observe process stability and authoritative state after rejection; do not run flooding against public services.

- If resource growth occurs, distinguish intended workload from unbounded retention and preserve diagnostic counters/logs.

- Deliver bounded reproduction fixtures and a focused limit/enforcement recommendation with its compatibility tradeoff.

### 4. Validate session lifetime and false positives

- Establish a long-lived connection, expire or revoke its local test session, then attempt another protected action.

- Test logout and reconnect behavior and inspect whether authorization is re-evaluated beyond the initial connection.

- Check logs for credentials or sensitive message content; use redacted evidence without exposing actual tokens.

- Repeat candidate findings with existing mitigations enabled and inspect whether configuration changes the prerequisite.

- If the exploit cannot reach the claimed privileged effect, narrow or withdraw the finding instead of retaining its original severity.

- Deliver verified findings, unverified candidates, and optional hardening separately with evidence and regression scenarios.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Trust-boundary map and scoped findings.
- Reproduction/evidence, mitigations, and severity rationale.
- Focused fixes or hardening proposals with verification scenarios.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Each finding has a concrete path and attacker prerequisite.
- Transport-specific guidance is applied only to its relevant context.
- Existing controls and negative evidence are considered.
- Verified findings, unverified candidates, and hardening proposals are distinct.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [WebSocket-specific defenses and tests](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html).
- [Gameplay authority and untrusted client input](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html).
