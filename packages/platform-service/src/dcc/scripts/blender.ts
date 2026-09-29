export function blenderDiscoverScript(): string {
  return `import bpy, json, sys\nprint('GCDCC_JSON:' + json.dumps({\n  'tool': 'blender',\n  'version': bpy.app.version_string,\n  'python': sys.version.split()[0],\n  'addons': sorted([name for name, state in bpy.context.preferences.addons.items() if state]),\n}))`;
}

export function blenderInspectScript(outputPath: string): string {
  return `import bpy, json\nfrom mathutils import Vector\nobjects = []\nfor obj in bpy.data.objects:\n    bounds = [list(obj.matrix_world @ Vector(corner)) for corner in obj.bound_box] if obj.type == 'MESH' else []\n    objects.append({'name': obj.name, 'type': obj.type, 'materials': [slot.material.name for slot in obj.material_slots if slot.material], 'bounds': bounds, 'vertices': len(obj.data.vertices) if obj.type == 'MESH' else 0, 'faces': len(obj.data.polygons) if obj.type == 'MESH' else 0})\nreport = {'tool': 'blender', 'version': bpy.app.version_string, 'objects': objects, 'meshes': sum(1 for obj in objects if obj['type'] == 'MESH'), 'materials': len(bpy.data.materials), 'armatures': sum(1 for obj in bpy.data.objects if obj.type == 'ARMATURE'), 'animations': [action.name for action in bpy.data.actions], 'collections': [collection.name for collection in bpy.data.collections]}\nwith open(${JSON.stringify(outputPath)}, 'w', encoding='utf-8') as file: json.dump(report, file, indent=2)\nprint('GCDCC_JSON:' + json.dumps(report))`;
}

export function blenderImportScript(filePath: string, format: string, outputPath: string): string {
  const importOperation = blenderImportOperation(format, filePath);
  return `import bpy, json\nbefore = set(obj.name for obj in bpy.data.objects)\n${importOperation}\ncreated = sorted(obj.name for obj in bpy.data.objects if obj.name not in before)\nbpy.ops.wm.save_as_mainfile(filepath=${JSON.stringify(outputPath)})\nprint('GCDCC_JSON:' + json.dumps({'imported': created}))`;
}

export function blenderExportScript(outputPath: string, format: string): string {
  const exportOperation = blenderExportOperation(format, outputPath);
  return `import bpy, json\n${exportOperation}\nprint('GCDCC_JSON:' + json.dumps({'output': ${JSON.stringify(outputPath)}, 'format': ${JSON.stringify(format)}}))`;
}

export function blenderValidateScript(outputPath: string): string {
  return `import bpy, json, os\nmissing = []\nfor image in bpy.data.images:\n    if image.source == 'FILE' and image.filepath:\n        resolved = bpy.path.abspath(image.filepath)\n        if not os.path.exists(resolved): missing.append({'image': image.name, 'path': resolved})\nnonManifold = []\nfor obj in bpy.data.objects:\n    if obj.type != 'MESH': continue\n    bm = None\n    try:\n        import bmesh\n        bm = bmesh.new(); bm.from_mesh(obj.data)\n        count = sum(1 for edge in bm.edges if not edge.is_manifold)\n        if count: nonManifold.append({'object': obj.name, 'edges': count})\n    finally:\n        if bm: bm.free()\nreport = {'tool': 'blender', 'version': bpy.app.version_string, 'missingTextures': missing, 'nonManifold': nonManifold}\nwith open(${JSON.stringify(outputPath)}, 'w', encoding='utf-8') as file: json.dump(report, file, indent=2)\nprint('GCDCC_JSON:' + json.dumps(report))`;
}

export function blenderRenderScript(outputPath: string, resolution: number, samples: number): string {
  return `import bpy, json, os\nscene = bpy.context.scene\nrender_engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items}\nscene.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in render_engines else 'BLENDER_EEVEE'\nscene.render.resolution_x = ${resolution}\nscene.render.resolution_y = ${resolution}\nscene.render.resolution_percentage = 100\nscene.render.image_settings.file_format = 'PNG'\nscene.render.filepath = ${JSON.stringify(outputPath)}\nif hasattr(scene, 'eevee') and hasattr(scene.eevee, 'taa_render_samples'): scene.eevee.taa_render_samples = ${samples}\nbpy.ops.render.render(write_still=True)\nprint('GCDCC_JSON:' + json.dumps({'output': scene.render.filepath, 'exists': os.path.exists(scene.render.filepath)}))`;
}

export function blenderRunScriptCommand(scriptPath: string): string[] {
  return ['--background', '--python', scriptPath];
}

export function blenderImportOperation(format: string, filePath: string): string {
  switch (format.toLowerCase()) {
    case 'glb':
    case 'gltf':
      return `bpy.ops.import_scene.gltf(filepath=${JSON.stringify(filePath)})`;
    case 'fbx':
      return `bpy.ops.import_scene.fbx(filepath=${JSON.stringify(filePath)})`;
    case 'obj':
      return `bpy.ops.wm.obj_import(filepath=${JSON.stringify(filePath)})`;
    case 'usd':
    case 'usdz':
      return `bpy.ops.wm.usd_import(filepath=${JSON.stringify(filePath)})`;
    default:
      throw new Error(`Blender import does not support ${format}.`);
  }
}

export function blenderExportOperation(format: string, outputPath: string): string {
  switch (format.toLowerCase()) {
    case 'glb':
      return `bpy.ops.export_scene.gltf(filepath=${JSON.stringify(outputPath)}, export_format='GLB')`;
    case 'gltf':
      return `bpy.ops.export_scene.gltf(filepath=${JSON.stringify(outputPath)}, export_format='GLTF_SEPARATE')`;
    case 'fbx':
      return `bpy.ops.export_scene.fbx(filepath=${JSON.stringify(outputPath)})`;
    case 'obj':
      return `bpy.ops.wm.obj_export(filepath=${JSON.stringify(outputPath)})`;
    case 'usd':
      return `bpy.ops.wm.usd_export(filepath=${JSON.stringify(outputPath)})`;
    default:
      throw new Error(`Blender export does not support ${format}.`);
  }
}
