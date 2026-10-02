# PlayWeld identity and compatibility

**Last updated:** 2026-10-02

## Confirmed identity

The user selected **PlayWeld** as the public product name and reported purchasing **playweld.com** on 2026-10-02. Use the capitalization PlayWeld in product text, window titles, menus, documentation, and future installer display names. The domain is the selected public address; ownership is user-reported, and website hosting, DNS, and email setup have not been verified in this repository. The user authorized the full repository/desktop rebrand and artwork creation; website code belongs to a separate project. The visual identity is an authored default documented in [the brand asset handoff](../assets/brand/README.md). No separate logo approval or trademark policy has been confirmed.

## Compatibility identifiers

The selected engineering default is to retain existing technical identifiers during this public rebrand. This avoids changing the addresses and paths used to find existing Projects, settings, credentials, plugins, and releases. These identifiers are compatibility contracts, not the public product name:

| Surface | Retained identifier |
| --- | --- |
| npm workspace scope and service CLI | `@gamecrafter/*`, `gamecrafter-service` |
| Installer application ID | `ai.gamecrafter.controlroom` |
| Executables | `GameCrafter.exe` on Windows, `gamecrafter` on Linux |
| Profile and default Project paths | Existing `GameCrafter` / `gamecrafter` profile directories and `GameCrafterProjects` |
| Project records and plugin manifests | `.gamecrafter/`, `gamecrafter-plugin.json` |
| Metadata, environment, RPC, command, theme, and CSS identifiers | Existing `gamecrafter-`, `GAMECRAFTER_*`, and related identifiers |
| Repository, release feed, and release metadata | Existing GitHub GameCrafter URLs and `gamecrafter-release.json` |
| Bundled legal resource filenames | `LICENSE.GameCrafter.txt`, `NOTICE.GameCrafter.txt` |

Future installer artifacts use the PlayWeld display name. Previously staged installers and historical verification records retain their original names and provenance. The staging launcher is named `Launch-PlayWeld-Test.cmd`; its isolated test-profile paths retain their existing identity.

Changing technical identifiers requires an explicit migration design covering profile discovery, credentials, Project records, plugins, shortcuts, updater discovery, rollback, and existing installations. Source configuration changes alone do not prove installation or upgrade compatibility.

## Repository evidence and remaining work

The public-name source changes cover desktop/browser configuration, Control Room labels and assistant identity, theme labels, installer display/artifact names, release automation, current guides, and bundled skill prose. Package names, data paths, app IDs, and connector contracts retain their existing identity.

Validation on 2026-10-02: the 0.1.4 source passed all 33 build/typecheck/lint/test tasks, including Electron/browser builds, and formatting/generated-reference/link checks. Brand exports passed PNG decoding and ICO frame validation. The Windows package passed native/version/skill/legal-resource checks and twenty-six desktop workflow checks with no renderer errors; the browser and packaged app show the canonical home mark, favicon, PlayWeld title, and service version. NSIS lifecycle/upgrade/rollback and Linux packaging remain unverified. Detailed results are in [0.1.4 release notes](releases/v0.1.4.md).

The full public rebrand adds service/update messages, new Project instruction templates, automated Git author display names, the home-header mark, favicon, and package icons. The 0.1.4 build is recorded in [release notes](releases/v0.1.4.md). Older packaged binaries and historical records retain their original branding and provenance. Website content and deployment, domain services, repository transfer or rename, and fork-branding rules remain outside this change. See [implementation status](STATUS.md), the [decision log](PLATFORM_DESIGN.md#decision-log), and [P01](OPEN_DECISIONS.md#1-product-identity-and-distribution).
