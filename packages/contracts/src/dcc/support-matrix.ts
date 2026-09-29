import type { DccOsSupport, DccTool } from './schema';

const source = 'docs/research/dcc-and-asset-tools.md §Authoring applications and §Support matrix';

export const DCC_TOOLS: readonly DccTool[] = ['blender', 'maya', '3dsmax', 'cinema4d', 'zbrush'];

export const DCC_HOST_OS: readonly DccOsSupport['os'][] = ['linux', 'win32', 'darwin'];

export const DCC_SUPPORT_MATRIX: readonly DccOsSupport[] = [
  {
    tool: 'blender',
    os: 'linux',
    headless: 'documented',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: Blender background Python is documented on Linux.`,
  },
  {
    tool: 'blender',
    os: 'win32',
    headless: 'documented',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: Blender background Python is documented on Windows.`,
  },
  {
    tool: 'blender',
    os: 'darwin',
    headless: 'unverified',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: the note documents Windows/Linux automation; macOS CLI support is not established here.`,
  },
  {
    tool: 'maya',
    os: 'linux',
    headless: 'documented',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: mayapy is documented for Linux.`,
  },
  {
    tool: 'maya',
    os: 'win32',
    headless: 'documented',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: mayapy and mayabatch are documented for Windows.`,
  },
  {
    tool: 'maya',
    os: 'darwin',
    headless: 'unverified',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: the cited CLI support matrix covers Linux/Windows; macOS automation is not established here.`,
  },
  {
    tool: '3dsmax',
    os: 'linux',
    headless: 'unsupported',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: Autodesk documents 3dsmaxbatch for Windows; Linux is unsupported.`,
  },
  {
    tool: '3dsmax',
    os: 'win32',
    headless: 'documented',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: Autodesk documents 3dsmaxbatch with MAXScript/Python.`,
  },
  {
    tool: '3dsmax',
    os: 'darwin',
    headless: 'unsupported',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: the vendor support matrix does not list macOS.`,
  },
  {
    tool: 'cinema4d',
    os: 'linux',
    headless: 'unverified',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: Linux Commandline is render-only; scripted operations via c4dpy are unverified.`,
  },
  {
    tool: 'cinema4d',
    os: 'win32',
    headless: 'documented',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: c4dpy is documented for Windows.`,
  },
  {
    tool: 'cinema4d',
    os: 'darwin',
    headless: 'documented',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: c4dpy is documented for macOS.`,
  },
  {
    tool: 'zbrush',
    os: 'linux',
    headless: 'unsupported',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: the cited ZBrush CLI examples are Windows executables; Linux support is unverified/unsupported.`,
  },
  {
    tool: 'zbrush',
    os: 'win32',
    headless: 'documented',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: ZBrush documents startup scripts and batch execution on Windows.`,
  },
  {
    tool: 'zbrush',
    os: 'darwin',
    headless: 'unsupported',
    liveBridge: 'community-plugin',
    sourceNote: `${source}: the cited ZBrush CLI examples are Windows executables; macOS support is not documented.`,
  },
];
