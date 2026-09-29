import type { DccOperation } from '@gamecrafter/contracts';

export function mayaScript(
  operation: DccOperation,
  filePath: string,
  outputPath: string,
  format: string,
): string {
  const initialize = [
    'import json',
    'import maya.cmds as cmds',
    'try:',
    '    import maya.standalone',
    "    maya.standalone.initialize(name='python')",
    'except Exception:',
    '    pass',
  ].join('\n');
  if (operation === 'inspect') {
    return `${initialize}\ncmds.file(${JSON.stringify(filePath)}, open=True, force=True)\nreport = {'tool':'maya','version':cmds.about(version=True),'nodes':cmds.ls(long=True) or [],'meshes':cmds.ls(type='mesh') or [],'materials':cmds.ls(materials=True) or []}\nprint('GCDCC_JSON:' + json.dumps(report))`;
  }
  if (operation === 'import') {
    return `${initialize}\ncmds.file(new=True, force=True)\ncmds.file(${JSON.stringify(filePath)}, i=True, type=${JSON.stringify(mayaFileType(format))}, ignoreVersion=True, ra=True, mergeNamespacesOnClash=False, namespace='dccImport')\ncmds.file(rename=${JSON.stringify(outputPath)})\ncmds.file(save=True, type='mayaAscii')\nprint('GCDCC_JSON:' + json.dumps({'imported': ${JSON.stringify(filePath)}}))`;
  }
  if (operation === 'export' || operation === 'convert') {
    return `${initialize}\ncmds.file(${JSON.stringify(filePath)}, open=True, force=True)\ncmds.file(${JSON.stringify(outputPath)}, force=True, options='v=0;', type=${JSON.stringify(mayaFileType(format))}, preserveReferences=True, exportAll=True)\nprint('GCDCC_JSON:' + json.dumps({'output': ${JSON.stringify(outputPath)}, 'format': ${JSON.stringify(format)}}))`;
  }
  if (operation === 'validate') {
    return `${initialize}\ncmds.file(${JSON.stringify(filePath)}, open=True, force=True)\nreport = {'tool':'maya','version':cmds.about(version=True),'references':cmds.file(q=True, reference=True) or [],'nodes':len(cmds.ls(long=True) or [])}\nprint('GCDCC_JSON:' + json.dumps(report))`;
  }
  return `${initialize}\nprint('GCDCC_JSON:' + json.dumps({'tool':'maya','operation':${JSON.stringify(operation)},'version':cmds.about(version=True)}))`;
}

function mayaFileType(format: string): string {
  switch (format.toLowerCase()) {
    case 'fbx':
      return 'FBX export';
    case 'obj':
      return 'OBJexport';
    case 'ma':
      return 'mayaAscii';
    default:
      return 'mayaBinary';
  }
}
