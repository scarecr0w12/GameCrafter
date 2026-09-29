import type { DccOperation } from '@gamecrafter/contracts';

export function maxScript(operation: DccOperation, filePath: string, outputPath: string, format: string): string {
  const preamble = "import json\nfrom pymxs import runtime as rt\n";
  if (operation === 'inspect') {
    return `${preamble}nodes = [node.name for node in rt.objects]\nreport = {'tool':'3dsmax','version':rt.maxVersion()[0],'nodes':nodes,'meshes':sum(1 for node in rt.objects if rt.classOf(node) == rt.GeometryClass)}\nprint('GCDCC_JSON:' + json.dumps(report))\n`;
  }
  if (operation === 'import') {
    return `${preamble}rt.importFile(${JSON.stringify(filePath)}, rt.Name('noPrompt'), using=rt.Name(${JSON.stringify(format)}))\nrt.saveMaxFile(${JSON.stringify(outputPath)}, useNewFile=True)\nprint('GCDCC_JSON:' + json.dumps({'imported':${JSON.stringify(filePath)}}))\n`;
  }
  if (operation === 'export' || operation === 'convert') {
    return `${preamble}rt.exportFile(${JSON.stringify(outputPath)}, rt.Name('noPrompt'), selectedOnly=False, using=rt.Name(${JSON.stringify(format)}))\nprint('GCDCC_JSON:' + json.dumps({'output':${JSON.stringify(outputPath)},'format':${JSON.stringify(format)}}))\n`;
  }
  if (operation === 'render-preview') {
    return `${preamble}rt.render(outputfile=${JSON.stringify(outputPath)})\nprint('GCDCC_JSON:' + json.dumps({'output':${JSON.stringify(outputPath)}}))\n`;
  }
  if (operation === 'validate') {
    return `${preamble}report = {'tool':'3dsmax','version':rt.maxVersion()[0],'nodes':len(rt.objects)}\nprint('GCDCC_JSON:' + json.dumps(report))\n`;
  }
  return `${preamble}print('GCDCC_JSON:' + json.dumps({'tool':'3dsmax','operation':${JSON.stringify(operation)}}))\n`;
}
