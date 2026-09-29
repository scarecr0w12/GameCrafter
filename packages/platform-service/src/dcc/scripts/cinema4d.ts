import type { DccOperation } from '@gamecrafter/contracts';

export function cinemaScript(
  operation: DccOperation,
  inputPath: string,
  outputPath: string,
  format: string,
  userScript: string,
  renderResolution: number,
): string {
  if (operation === 'run-script') return userScript;
  const preamble = "import c4d, json\nfrom c4d import documents\ndoc = documents.GetActiveDocument()\n";
  if (operation === 'inspect') {
    return `${preamble}objects = []\nobj = doc.GetFirstObject() if doc else None\nwhile obj:\n    objects.append({'name':obj.GetName(),'type':obj.GetType()})\n    obj = obj.GetNext()\nprint('GCDCC_JSON:' + json.dumps({'tool':'cinema4d','objects':objects}))\n`;
  }
  if (operation === 'import') {
    return `${preamble}doc = documents.LoadDocument(${JSON.stringify(inputPath)}, c4d.SCENEFILTER_OBJECTS | c4d.SCENEFILTER_MATERIALS)\nif doc: documents.SaveDocument(doc, ${JSON.stringify(outputPath)}, c4d.SAVEDOCUMENTFLAGS_0, c4d.FORMAT_C4DEXPORT)\nprint('GCDCC_JSON:' + json.dumps({'output':${JSON.stringify(outputPath)}}))\n`;
  }
  if (operation === 'export' || operation === 'convert') {
    return `${preamble}doc = documents.LoadDocument(${JSON.stringify(inputPath)}, c4d.SCENEFILTER_OBJECTS | c4d.SCENEFILTER_MATERIALS)\nif doc: documents.SaveDocument(doc, ${JSON.stringify(outputPath)}, c4d.SAVEDOCUMENTFLAGS_0, c4d.FORMAT_C4DEXPORT)\nprint('GCDCC_JSON:' + json.dumps({'output':${JSON.stringify(outputPath)},'format':${JSON.stringify(format)}}))\n`;
  }
  if (operation === 'validate') {
    return `${preamble}print('GCDCC_JSON:' + json.dumps({'tool':'cinema4d','document':doc.GetDocumentName() if doc else None}))\n`;
  }
  if (operation === 'render-preview') {
    return `${preamble}import c4d.bitmaps\ndoc = documents.LoadDocument(${JSON.stringify(inputPath)}, c4d.SCENEFILTER_OBJECTS | c4d.SCENEFILTER_MATERIALS)\nrd = doc.GetActiveRenderData()\nrd[c4d.RDATA_XRES] = ${renderResolution}\nrd[c4d.RDATA_YRES] = ${renderResolution}\nbmp = c4d.bitmaps.BaseBitmap()\nbmp.Init(${renderResolution}, ${renderResolution}, 24)\nresult = documents.RenderDocument(doc, rd, bmp, c4d.RENDERFLAGS_EXTERNAL)\nbmp.Save(${JSON.stringify(outputPath)}, c4d.FORMAT_PNG)\nprint('GCDCC_JSON:' + json.dumps({'tool':'cinema4d','output':${JSON.stringify(outputPath)},'result':result}))\n`;
  }
  return `${preamble}print('GCDCC_JSON:' + json.dumps({'tool':'cinema4d','operation':${JSON.stringify(operation)}}))\n`;
}
