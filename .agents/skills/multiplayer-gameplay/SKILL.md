---
name: multiplayer-gameplay
description: "Design, implement, or diagnose networked gameplay authority, replication, prediction, sessions, lobbies, reconnect, or dedicated-server behavior. Use for multiplayer game features and desynchronization; require separate-process evidence before claiming network validation."
license: Apache-2.0
metadata:
  gamecrafter-version: '1.0.0'
---

# Multiplayer gameplay

Implement one networked gameplay path with explicit authority and failure handling before expanding the multiplayer surface.

## Working agreement

- Follow the user’s current scope and existing authorization; use reversible defaults for routine choices.
- Read relevant project instructions, decisions, and current artifacts before changing their meaning.
- Separate user-confirmed requirements, proposed defaults, implementation, and verification evidence.
- Use actual installed tools and documented interfaces; record missing capabilities explicitly.
- Keep durable Project/task/board records in the platform service through supported contracts.
- Read [scenario workflows](references/workflows.md) when preparing examples, handoffs, or verification.

## Inputs to establish

- Session type, player count, persistence, competitive/cooperative intent.
- Engine/version, transport, topology, authentication provider, and supported platforms.
- Gameplay state ownership, bandwidth/latency targets, and existing network evidence.

## Procedure

### 1. Choose a session model

- Document listen server, dedicated server, or other topology with authority boundaries.
- Treat fairness, operating cost, and offline behavior as product-relevant tradeoffs.

### 2. Assign state ownership

- Name who decides movement, combat, inventory, rewards, and match outcomes.
- For competitive or persistent worlds validate client intent at the authority.

### 3. Specify messages

- List sender, receiver, arguments, reliability/order, limits, and authorization.
- Separate ephemeral presentation from gameplay-critical state transitions.

### 4. Implement a vertical interaction

- Connect two separate processes and execute one action through authority and replication.
- Record server/client logs and visible result before adding more mechanics.

### 5. Handle timing

- Define tick and update assumptions, interpolation, prediction, and correction where needed.
- Test reordered, delayed, duplicated, and lost information according to the transport.

### 6. Implement join and leave

- Specify lobby entry, loading readiness, late join, disconnect, reconnect, and cleanup.
- Decide what happens to owned objects and pending actions when a peer disappears.

### 7. Validate hostile intent

- Reject impossible actions, unauthorized object access, invalid arguments, and excessive frequency.
- Route service/transport controls to security-review; do not trust a connected peer automatically.

### 8. Test abnormal networks

- Use controlled latency/loss simulation where available and record its configuration.
- Inspect authority, recovery, player feedback, and duplicate rewards across failures.

### 9. Inspect dedicated deployment

- Verify headless/server export and remove assumptions that the host is a player.
- Pin setup commands to the installed engine and record platform constraints.

### 10. Deliver evidence and boundaries

- Provide topology, message table, runnable scenario, logs, and observed limits.
- Distinguish local multi-instance tests from remote target-platform verification.

## Deliverables

- Topology and authority map; bounded message/RPC contract.
- Session lifecycle and synchronization behavior.
- Separate-process test results, recordings/logs, and deployment limits.

## Completion review

- Client attempts cannot directly award authoritative resources or match results.
- Late joins receive coherent current state rather than stale initialization.
- Disconnect/retry cannot repeat a completed transaction.
- Network claims identify separate processes, transport, and simulation settings.

## Gotchas

- Reliable transport does not establish application authorization.
- Engine examples may assume the host is also a player.
- Encryption, authentication, anti-cheat, and gameplay fairness are separate controls.

## Evidence and sources

These workflows are authored recommendations. Source links below support the named mechanisms, not a claim that PlayWeld has executed them.
Last researched: 2026-10-01.

- [Authority, RPC validation, and dedicated-server caveats](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html).
- [Early network architecture](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview-for-unreal-engine).
