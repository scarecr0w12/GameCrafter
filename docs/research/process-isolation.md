# Plugin Worker Process Isolation Options

**Last researched:** 2026-09-27

## Purpose

Compare host-OS process isolation primitives for executing native plugin workers on supported Windows and Linux desktops without Docker/Podman. The platform design requires isolated plugin processes and brokered access but has not selected the mechanism ([platform design](../PLATFORM_DESIGN.md#confirmed-requirements-and-decisions), [technical architecture](../TECHNICAL_ARCHITECTURE.md#agent-model-and-access-design)). None of the options below should be described as proven secure without implementation-specific testing.

## Windows

### AppContainer / LowBox tokens

- AppContainer is a Windows token identity with package and capability SIDs; access checks combine those SIDs with normal user/group ACLs, so resources need explicit grants ([Microsoft AppContainer implementation](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)).
- Microsoft describes AppContainer as denying access to most resources by default, with filesystem access granted through ACLs and network access granted through capabilities; without the applicable network capability, network access is denied ([AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation), [implementation](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)).
- AppContainer is available beginning with Windows 8; LowBox tokens are the kernel token form used for this execution identity ([Microsoft implementation guide](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer), [LowBox token API](https://learn.microsoft.com/en-us/windows/win32/secauthz/ntcreatelowboxtoken)).
- AppContainer profile creation is a per-user operation. The API can return access denied, so profile creation and process launch must be tested under standard-user accounts; blanket claims that every setup succeeds unprivileged are unverified ([CreateAppContainerProfile](https://learn.microsoft.com/en-us/windows/win32/api/userenv/nf-userenv-createappcontainerprofile)).
- A worker needs explicit access to its executable/runtime, plugin files, temporary directory, and broker IPC; explicit per-file/directory ACL access may be needed in addition to token capabilities ([Microsoft AppContainer guide](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)).
- AppContainer does not by itself provide CPU/memory/time accounting; pair it with a Job Object for process-tree lifecycle and resource limits ([Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)).

### Restricted tokens

- `CreateRestrictedToken` can remove privileges, mark group SIDs deny-only, and add restricting SIDs; these are access-token reductions rather than a standalone filesystem/network namespace ([Microsoft token privilege guide](https://learn.microsoft.com/en-us/windows/win32/secbp/changing-privileges-in-a-token)).
- Restricted tokens can reduce authority of workers that run under the same user identity, but file access still depends on object ACL checks; they do not automatically hide unrelated user files or establish network isolation ([CreateRestrictedToken guide](https://learn.microsoft.com/en-us/windows/win32/secbp/changing-privileges-in-a-token), [AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation)).
- Use restricted tokens as a complementary hardening layer, not as the sole Restricted/Ask-always boundary. Effective coverage for arbitrary Node, Python, and native plugins is unverified and requires adversarial tests.

### Job Objects

- Job Objects manage groups of processes as a unit and can enforce limits such as working set, process priority, and end-of-job time; `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` terminates job processes when the final job handle closes ([Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)).
- A Job Object is valuable for worker-tree cleanup and resource accounting, but it does not impose path-based filesystem or outbound-network policy ([Microsoft Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)).
- Job security limitations must be applied to each process; Microsoft notes legacy job-token security limits were removed beginning with Windows Vista ([Job Object security/access rights](https://learn.microsoft.com/en-us/windows/win32/procthread/job-object-security-and-access-rights)).

### Windows Sandbox (not suitable as routine plugin-worker isolation)

- Windows Sandbox is a temporary virtualized desktop; closing it discards software, files, and state. Microsoft documents Windows 10 version 1903 or later, Windows 11, supported editions such as Pro/Enterprise/Education, and hardware virtualization requirements ([Windows Sandbox overview](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/), [installation requirements](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-install)).
- Networking is enabled by default; configuration can disable it and can mount host folders read-only or writable, with Microsoft warning that mapped folders can expose host files ([Sandbox configuration](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file), [overview](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/)).
- It is a heavier whole-OS disposable VM rather than an inexpensive per-plugin process boundary; each worker would also need runtime/software installation and explicit project-folder sharing. These engineering limitations follow from its documented lifecycle and virtualization model ([Sandbox architecture](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-architecture)).
- Microsoft documents one Sandbox instance at a time, so it does not fit concurrent swarm plugin workers ([FAQ](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-faq)).

## Linux

### bubblewrap (`bwrap`) and user namespaces

- bubblewrap creates a new mount namespace with an empty tmpfs root, then lets the launcher construct visible filesystem mounts; it can additionally unshare user, PID, IPC, network, and UTS namespaces ([bubblewrap README](https://github.com/containers/bubblewrap/blob/main/README.md), [bwrap manual](https://man.archlinux.org/man/extra/bubblewrap/bwrap.1.en)).
- Non-root use depends on kernel support for unprivileged user namespaces and distribution sysctl policy. Flatpak documents default unprivileged support on recent Ubuntu/Fedora, Debian 11+, RHEL 8+, and default Arch Linux, while noting that some distributions disable user namespaces ([Flatpak user-namespace requirements](https://github.com/flatpak/flatpak/wiki/User-namespace-requirements)).
- User namespaces allow an unprivileged process to be mapped to namespace-local IDs/capabilities, but availability and allowed namespace types depend on kernel and host policy ([user_namespaces(7)](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)).
- bubblewrap is a sandbox-construction tool, not a complete policy: filesystem mounts and namespace choices supplied by our launcher determine the actual boundary ([bubblewrap README](https://github.com/containers/bubblewrap/blob/main/README.md)).
- Flatpak is a known deployed user of bubblewrap; its sandbox defaults restrict host files, network, devices, processes, and selected syscalls, while permissions selectively expose resources ([Flatpak sandbox permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html), [Flatpak user namespaces](https://github.com/flatpak/flatpak/wiki/User-namespace-requirements)).

### Landlock

- Landlock lets any process, including an unprivileged process, add restrictions to its own future access; it is a stackable Linux Security Module for scoped access controls ([kernel Landlock userspace API](https://docs.kernel.org/7.1/userspace-api/landlock.html)).
- Landlock rules cover filesystem rights, and newer ABI levels add specific TCP bind/connect restrictions; applications must probe the runtime ABI because older supported ABIs expose fewer rights ([kernel Landlock ABI reference](https://docs.kernel.org/7.1/userspace-api/landlock.html)).
- Enforcing rules requires `no_new_privs` or `CAP_SYS_ADMIN` in the relevant namespace; the normal unprivileged use case sets `no_new_privs` and self-restricts before loading plugin code ([Landlock userspace API](https://docs.kernel.org/7.1/userspace-api/landlock.html)).
- Landlock is not a process or PID namespace and does not replace mount isolation; inherited file descriptors remain important to access policy ([Landlock userspace API](https://docs.kernel.org/7.1/userspace-api/landlock.html)).
- Landlock was introduced in Linux 5.13, but features vary by ABI and distro kernel configuration; probe at runtime rather than assuming support ([landlock(7)](https://www.man7.org/linux/man-pages/man7/landlock.7.html)).

### seccomp-BPF

- seccomp filter mode evaluates system call numbers and arguments using BPF and can reduce exposed kernel surface; child processes inherit filters across fork/clone/exec where those operations are permitted ([Linux seccomp filter documentation](https://docs.kernel.org/userspace-api/seccomp_filter.html)).
- An unprivileged process may install a filter after setting `no_new_privs`; seccomp is useful for syscall reduction, not direct path-based filesystem policy ([seccomp(2)](https://www.man7.org/linux/man-pages/man2/seccomp.2.html)).
- The Linux kernel documentation explicitly says syscall filtering alone is not a sandbox; pair it with filesystem and namespace controls ([seccomp filter docs](https://docs.kernel.org/userspace-api/seccomp_filter.html)).

### systemd-run --user

- `systemd-run --user` submits a transient unit to the caller's user service manager; process lifetime and lingering depend on the user's logind/systemd configuration ([systemd-run](https://freedesktop.org/software/systemd/man/latest/systemd-run.html)).
- systemd unit properties include filesystem controls (`ProtectSystem=`, `ProtectHome=`, `PrivateTmp=`), network controls (`PrivateNetwork=`, `RestrictAddressFamilies=`), and syscall/kernel/proc/device restrictions (`SystemCallFilter=` and related properties) ([systemd.exec](https://freedesktop.org/software/systemd/man/latest/systemd.exec.html)).
- Some properties in a per-user manager implicitly rely on unprivileged user namespaces; systemd documents host-kernel/sysctl requirements and that not every property applies in every manager context ([systemd.exec](https://freedesktop.org/software/systemd/man/latest/systemd.exec.html)).
- `systemd-run --user` is attractive when available but is not portable across all Linux installations; absent systemd user managers, restricted user namespace policy, or unsupported properties require a direct launcher fallback ([systemd-run](https://freedesktop.org/software/systemd/man/latest/systemd-run.html), [systemd.exec](https://freedesktop.org/software/systemd/man/latest/systemd.exec.html)).

### Firejail

- Firejail combines Linux namespaces, seccomp-BPF, Linux capabilities, and optional cgroups to give a process private views of kernel resources; profiles control the mounted filesystem view ([firejail manual](https://man7.org/linux/man-pages/man1/firejail.1.html)).
- The documented implementation is a setuid binary, which the manual identifies as a privilege-escalation risk if Firejail itself is exploited; it recommends restricting who can run it ([firejail manual](https://man7.org/linux/man-pages/man1/firejail.1.html)).
- It is an optional host package rather than a guaranteed Linux primitive; validate package availability, setuid policy, profile, and version before making it a required dependency ([firejail manual](https://man7.org/linux/man-pages/man1/firejail.1.html)).

### Known layered deployments

- Chromium's Linux sandbox uses multiple layers selected according to available kernel features, including namespaces and seccomp-BPF; Chromium's documentation says it uses a setuid helper as well ([Chromium Linux sandbox](https://chromium.googlesource.com/chromium/src/+/HEAD/sandbox/linux)).
- Flatpak uses bubblewrap to build app sandboxes and documents explicit filesystem/network/process/device restrictions rather than claiming that one namespace is sufficient ([Flatpak permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html), [user namespace requirements](https://github.com/flatpak/flatpak/wiki/User-namespace-requirements)).

## Runtime-level options (not OS isolation)

### Node.js Permission Model

- Node's `--permission` model can deny selected process access to filesystem, network, child processes, workers, native addons, WASI, FFI, and inspector APIs unless allowed ([Node.js Permission Model](https://nodejs.org/api/permissions.html)).
- The Node.js security policy characterizes this as a seat-belt model and explicitly says it does not provide security guarantees against malicious code; it is not a substitute for the OS boundary ([Node permissions documentation](https://nodejs.org/api/permissions.html), [Node security policy](https://github.com/nodejs/node/blob/main/SECURITY.md)).

### worker_threads

- Worker `resourceLimits` restrict selected V8 engine memory parameters but do not cap external data such as `ArrayBuffer`; Node warns a process can still abort on global out-of-memory conditions ([worker_threads](https://nodejs.org/api/worker_threads.html)).
- Workers share one OS process and therefore are not a filesystem, network, credential, or kernel boundary; use them for cooperative task parallelism, not untrusted plugin containment ([Node worker_threads](https://nodejs.org/api/worker_threads.html)).

### isolated-vm and vm2

- `isolated-vm` provides V8 isolates and documents memory limits, but its README warns that careless transfer of references can expose the host isolate and that using it does not automatically make untrusted execution safe; the README calls the project maintenance mode ([isolated-vm README](https://github.com/laverdet/isolated-vm)). Package release cadence and repository README status can differ; current support commitment should be rechecked before adoption ([npm package](https://www.npmjs.com/package/isolated-vm)).
- `vm2`'s repository README marks the project discontinued, warns of critical sandbox escapes, and says not to use it in production ([vm2 README](https://github.com/patriksimek/vm2/blob/master/README.md)). Do not use `vm2` as plugin isolation.

### Deno as comparison

- Deno denies filesystem, network, environment, and subprocess access by default and supports scoped grants ([Deno security and permissions](https://docs.deno.com/runtime/fundamentals/security/)).
- Deno warns that a spawned subprocess runs outside the parent's Deno permission sandbox, so granting `--allow-run` can undermine the runtime permission boundary ([Deno subprocess guidance](https://docs.deno.com/runtime/reference/permissions/)).
- Deno's model is a runtime guardrail comparison, not proof of OS-enforced isolation for arbitrary native plugin processes ([Deno security docs](https://docs.deno.com/runtime/fundamentals/security/)).

## Recommended approach and caveats

- Windows candidate: launch each plugin in a uniquely named AppContainer/LowBox identity with only the explicit plugin/runtime/work directories and broker IPC ACLs, deny network by default, and place the process tree in a Job Object with kill-on-close and resource limits. Add a restricted token where compatible ([AppContainer](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer), [Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects), [restricted tokens](https://learn.microsoft.com/en-us/windows/win32/secbp/changing-privileges-in-a-token)).
- Linux candidate: invoke a small audited launcher using bwrap with an explicit read-only runtime, narrowly bound plugin/project scratch mounts, user/PID/mount namespaces, and a network namespace policy; then layer Landlock and a tested seccomp profile where available ([bubblewrap](https://github.com/containers/bubblewrap/blob/main/README.md), [Landlock](https://docs.kernel.org/7.1/userspace-api/landlock.html), [seccomp](https://docs.kernel.org/userspace-api/seccomp_filter.html)).
- Consider `systemd-run --user` as an optional host-specific backend, not the only Linux backend; feature-detect hardening settings and fail closed when required controls cannot be established ([systemd-run](https://freedesktop.org/software/systemd/man/latest/systemd-run.html), [systemd.exec](https://freedesktop.org/software/systemd/man/latest/systemd.exec.html)).
- Treat the OS launcher as the policy enforcement layer and the central broker as the only route to platform APIs, secrets, engine sessions, and network allowances; capability declarations should map to OS grants rather than prompts alone (design recommendation based on the above OS access-control sources).
- Run an escape/denial test suite per Windows release, Linux kernel/desktop distro, plugin language, and capability profile. Validate inherited handles, symlink/path races, child-process escape, IPC spoofing, network paths, resource exhaustion, and sandbox startup failure before claiming Restricted mode is enforced. No cited primitive establishes this entire end-to-end implementation as proven secure.

## Sources

- [Microsoft AppContainer implementation](https://learn.microsoft.com/en-us/windows/win32/secauthz/implementing-an-appcontainer)
- [Microsoft AppContainer isolation](https://learn.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation)
- [Microsoft LowBox token API](https://learn.microsoft.com/en-us/windows/win32/secauthz/ntcreatelowboxtoken)
- [CreateAppContainerProfile](https://learn.microsoft.com/en-us/windows/win32/api/userenv/nf-userenv-createappcontainerprofile)
- [Windows Job Objects](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects)
- [Windows Job Object security and access rights](https://learn.microsoft.com/en-us/windows/win32/procthread/job-object-security-and-access-rights)
- [CreateRestrictedToken guidance](https://learn.microsoft.com/en-us/windows/win32/secbp/changing-privileges-in-a-token)
- [Windows Sandbox overview](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/)
- [Windows Sandbox configuration](https://learn.microsoft.com/en-us/windows/security/application-security/application-isolation/windows-sandbox/windows-sandbox-configure-using-wsb-file)
- [bubblewrap README](https://github.com/containers/bubblewrap/blob/main/README.md)
- [bwrap manual](https://man.archlinux.org/man/extra/bubblewrap/bwrap.1.en)
- [Flatpak namespace requirements](https://github.com/flatpak/flatpak/wiki/User-namespace-requirements)
- [Flatpak permissions](https://docs.flatpak.org/en/latest/sandbox-permissions.html)
- [Linux user namespaces](https://man7.org/linux/man-pages/man7/user_namespaces.7.html)
- [Linux Landlock API](https://docs.kernel.org/7.1/userspace-api/landlock.html)
- [Linux seccomp filter](https://docs.kernel.org/userspace-api/seccomp_filter.html)
- [systemd-run](https://freedesktop.org/software/systemd/man/latest/systemd-run.html)
- [systemd.exec](https://freedesktop.org/software/systemd/man/latest/systemd.exec.html)
- [Firejail manual](https://man7.org/linux/man-pages/man1/firejail.1.html)
- [Chromium Linux sandbox](https://chromium.googlesource.com/chromium/src/+/HEAD/sandbox/linux)
- [Node.js permissions](https://nodejs.org/api/permissions.html)
- [Node.js worker_threads](https://nodejs.org/api/worker_threads.html)
- [isolated-vm](https://github.com/laverdet/isolated-vm)
- [vm2](https://github.com/patriksimek/vm2/blob/master/README.md)
- [Deno security model](https://docs.deno.com/runtime/fundamentals/security/)
