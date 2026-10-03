# PlayWeld glossary

**Last updated:** 2026-10-02

These meanings describe repository contracts. Product requirements remain in [platform design](PLATFORM_DESIGN.md); exact fields remain in [RPC schemas](reference/rpc-schemas.json).

| Term            | Meaning and practical consequence                                                                                                                                                                           |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project         | A registered game-development unit with its own ID, native engine identity, workspace path, metadata and service-owned records. A directory alone is not proof of registration.                             |
| Workspace       | The filesystem tree associated with a Project. Theia can open that tree; opening it is distinct from registering or trusting a Project.                                                                     |
| Profile         | The platform's local configuration/state root, selected with `GAMECRAFTER_PROFILE_DIR`. It contains registration, credentials, settings and lifecycle information; it is not a game workspace.              |
| Control Room    | The Theia desktop application and its service-backed views. The browser application is a development/test target.                                                                                           |
| Request         | A user's desired change, preserved by the change subsystem. Impact analysis, delegated tasks and integration can refer back to that request. A chat message does not automatically become a change request. |
| Task            | A durable work record with a goal, state, assignee, input, budget and result. A task may spawn children or wait for user input. Success describes its completion contract, not automatic integration.       |
| Agent           | A model-assisted task runner whose role, tools, skills, access ceiling and isolation constrain its work. A deterministic task handler is useful test infrastructure, not proof of model reasoning.          |
| Role            | A platform `ROLE.md` definition of work types, access/tool constraints, isolation and instructions. Agent Skills compatibility does not make roles a portable external standard.                            |
| Skill           | An Agent Skills directory headed by `SKILL.md`, optionally with scripts/references/assets. Activating instructions does not itself grant tool permissions.                                                  |
| Tool            | A registered operation with schemas, execution mode, side effects and evidence requirements.                                                                                                                |
| Tool call       | One broker-mediated invocation, with authorization, input, result/error and audit identity. Approving a call does not approve every later call.                                                             |
| Question        | A task's request for information. Answering supplies data to resume work; it is distinct from authorizing a side effect.                                                                                    |
| Approval        | A decision about a particular proposed operation under the access policy. Inspect its Project, tool, arguments and side effects.                                                                            |
| Run             | A recorded engine, DCC, backup or other subsystem execution. Interpret status together with logs, exit code and artifacts. Different run families have different schemas.                                   |
| Integration     | Applying isolated task changes to the Project under coordination rules. A completed worktree can remain unintegrated or have a conflict.                                                                    |
| Artifact        | A produced file or other declared output. Existence, readability, review, integration and target-engine acceptance are separate properties.                                                                 |
| Evidence        | Records supporting a completion claim, such as a test result, file, run or identity probe. A screenshot establishes the visible state at capture time.                                                      |
| Acceptance      | Checking an explicit expected behavior in a named environment and retaining evidence. A fixture result supports that fixture and operation; it is not production certification.                             |
| Canon           | Project knowledge/decisions treated as authoritative by the application's record model. A posted proposal becomes binding only through the user action provided for that purpose.                           |
| Connector       | A platform adapter for engine/DCC file, headless or live-editor operations. Capability and identity checks determine which operations are available.                                                        |
| MCP connection  | A configured external protocol endpoint, with transport/revision, credentials, discovery and tool adaptation. Connectivity does not establish live editor identity.                                         |
| Platform plugin | A manifest-defined contribution managed by the platform service with privileges and a worker runtime.                                                                                                       |
| Theia extension | An application dependency contributing frontend/backend modules; changes require building the application.                                                                                                  |
| Editor plugin   | Code/addons installed inside an engine or DCC editor, often supplying a live bridge. Its lifecycle is separate from platform plugin installation.                                                           |

Use the [workflow cookbook](WORKFLOW_COOKBOOK.md) for examples, [extension cookbook](EXTENSION_COOKBOOK.md) for contracts, and [operations guide](OPERATIONS_GUIDE.md) for recovery. The [coverage record](DOCUMENTATION_COVERAGE.md) separates current tutorial results from historical acceptance.
