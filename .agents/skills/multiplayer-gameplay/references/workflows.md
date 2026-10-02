# Multiplayer gameplay: scenario workflows

These are original worked recommendations. Fixtures and identifiers are hypothetical; substitute actual project contracts and supported tools.
Last researched: 2026-10-01.

## Worked request

**Request:** Two clients can claim the same chest reward.

**Initial investigation:** Trace ownership and message order for simultaneous requests.

**Proposed action:** Make the authority validate and commit the claim once, then replicate the outcome.

**Expected handoff:** Message contract, concurrent-request test logs, and reconnect/replay coverage.

## Coverage map

| Scenario | Decision or failure it exposes |
| --- | --- |
| Prove authority for a finite reward | Authority: Rejected request plus unchanged authoritative state. |
| Test timing and correction | Concurrent action: Exactly one accepted transition. |
| Exercise session transitions | Join/reconnect: Current state and defined recovery. |
| Validate a dedicated-server deployment | Adverse network: Configuration and convergence/failure observations. |

## Detailed scenarios

### 1. Prove authority for a finite reward

- Use two separate client processes and an authority process with one chest containing a single reward.

- Send nearly simultaneous claim requests and inspect authoritative chest state before and after each request.

- Attempt a request naming another player and another containing an impossible reward quantity; validate object/action authorization.

- Retry the accepted claim after disconnect or with duplicate delivery where transport semantics permit it.

- Assert one committed reward and coherent client presentation; a client animation alone cannot prove inventory correctness.

- Keep per-process logs, state snapshots, request ordering, and transport configuration; avoid logging authentication secrets.

### 2. Test timing and correction

- Use a repeatable movement route with a sharp turn, stop, collision, and one gameplay-critical interaction.

- Run baseline local conditions and a hypothetical 150 ms latency/loss profile only through supported simulation tools.

- Compare authority trajectory with presented client trajectory and identify whether divergence is transient or persistent.

- Test delayed movement followed by a reward interaction; do not allow presentation prediction to commit authoritative rewards.

- If correction feels abrupt, evaluate interpolation/prediction tradeoffs against responsiveness and cheating exposure.

- Save simulation settings and recordings with correction events rather than describing a LAN test as internet validation.

### 3. Exercise session transitions

- Join a second client after a door opens, inventory changes, and an encounter starts; inspect the current-state snapshot.

- Disconnect the owner of a spawned object during its pending action and check ownership transfer or cleanup.

- Reconnect with the same account and verify the intended identity/session behavior rather than relying on a new spawn.

- Interrupt loading before readiness confirmation and ensure the authority does not begin a session requiring missing participants.

- For listen servers, record host-disconnect behavior as an explicit design decision; do not assume host migration exists.

- Deliver join/leave state transitions and logs for both normal and interrupted lifecycle cases.

### 4. Validate a dedicated-server deployment

- Inspect headless export/build support for the installed engine and separate server initialization from local player creation.

- Run the actual dedicated artifact where available and confirm it starts without a rendering device or player UI assumption.

- Connect two clients, start through the intended lobby ownership rule, and run the finite-reward transaction.

- Test unavailable authentication, empty session, first-player departure, and shutdown cleanup using supported local fixtures.

- Inspect bandwidth and authority computation under representative gameplay; encryption and account identity remain separate checks.

- Report server build/platform and observed deployment scope; tutorial code or mock peers are not dedicated-server evidence.

## Reviewable handoff

Include the requested result and the evidence specific to the scenarios above:

- Topology and authority map; bounded message/RPC contract.
- Session lifecycle and synchronization behavior.
- Separate-process test results, recordings/logs, and deployment limits.

Keep proposed numbers, hypothetical fixtures, and unexecuted checks visible in the handoff. An authored plan or documented mechanism does not imply a successful runtime result.

## Acceptance assertions

- Client attempts cannot directly award authoritative resources or match results.
- Late joins receive coherent current state rather than stale initialization.
- Disconnect/retry cannot repeat a completed transaction.
- Network claims identify separate processes, transport, and simulation settings.

## Source boundaries

The sources support the named mechanisms below. Scenario choices, diagnostic sequences, and tradeoffs are original recommendations requiring project-specific validation.

- [Authority, RPC validation, and dedicated-server caveats](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html).
- [Early network architecture](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview-for-unreal-engine).
