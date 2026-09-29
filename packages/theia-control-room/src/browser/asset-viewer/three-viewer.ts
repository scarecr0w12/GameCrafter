import './three-process-shim';
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js' with {
  'resolution-mode': 'import',
};
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js' with {
  'resolution-mode': 'import',
};
import { nameBasedLodLevelCount } from '../../common/assets-view-model';

export interface AssetHierarchyEntry {
  id: string;
  name: string;
  type: string;
  depth: number;
  visible: boolean;
}

export interface AssetMaterialEntry {
  name: string;
  type: string;
  maps: string[];
  color?: string;
}

export class ThreeViewer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10_000);
  private readonly renderer: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private loader?: GLTFLoader;
  private readonly clock = new THREE.Clock();
  private model?: THREE.Object3D;
  private mixer?: THREE.AnimationMixer;
  private animations: THREE.AnimationClip[] = [];
  private readonly lodGroups: THREE.Object3D[][] = [];
  private frame?: number;
  private disposed = false;

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(host.clientWidth || 1, host.clientHeight || 1);
    host.appendChild(this.renderer.domElement);
    this.camera.position.set(4, 3, 5);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(4, 8, 5);
    this.scene.add(keyLight);
    const grid = new THREE.GridHelper(10, 20, 0x666677, 0x3b3b46);
    this.scene.add(grid);
    this.renderFrame();
  }

  async load(url: string): Promise<void> {
    this.clearModel();
    const [{ OrbitControls }, { GLTFLoader }] = await Promise.all([
      import('three/examples/jsm/controls/OrbitControls.js'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
    ]);
    if (this.disposed) return;
    if (!this.controls) {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
    }
    const loader = (this.loader ??= new GLTFLoader());
    await new Promise<void>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          if (this.disposed) {
            disposeObject(gltf.scene);
            resolve();
            return;
          }
          this.model = gltf.scene;
          this.animations = gltf.animations;
          this.scene.add(gltf.scene);
          if (gltf.animations.length) this.mixer = new THREE.AnimationMixer(gltf.scene);
          void this.configureLodGroups(gltf).then(() => {
            this.frameAll();
            resolve();
          }, reject);
        },
        undefined,
        (error) => reject(error),
      );
    });
  }

  resize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  frameAll(): void {
    const controls = this.controls;
    if (!this.model || !controls) return;
    const bounds = new THREE.Box3().setFromObject(this.model);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, 0.5);
    controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(radius * 1.8, radius * 1.2, radius * 2.2));
    this.camera.near = Math.max(0.01, radius / 1000);
    this.camera.far = Math.max(100, radius * 100);
    this.camera.updateProjectionMatrix();
    controls.update();
    controls.saveState();
  }

  resetCamera(): void {
    this.controls?.reset();
  }

  listAnimations(): string[] {
    return this.animations.map((clip) => clip.name || 'Animation');
  }

  playAnimation(name: string | null): void {
    if (!this.mixer) return;
    this.mixer.stopAllAction();
    const animations =
      name === null
        ? this.animations
        : this.animations.filter((clip) => (clip.name || 'Animation') === name);
    for (const clip of animations) this.mixer.clipAction(clip).reset().play();
  }

  setPaused(paused: boolean): void {
    if (this.mixer) this.mixer.timeScale = paused ? 0 : 1;
  }

  hierarchy(): AssetHierarchyEntry[] {
    if (!this.model) return [];
    const entries: AssetHierarchyEntry[] = [];
    const visit = (object: THREE.Object3D, depth: number): void => {
      entries.push({
        id: object.uuid,
        name: object.name || object.type,
        type: object.type,
        depth,
        visible: object.visible,
      });
      for (const child of object.children) visit(child, depth + 1);
    };
    visit(this.model, 0);
    return entries;
  }

  setNodeVisible(id: string, visible: boolean): void {
    const object = this.model?.getObjectByProperty('uuid', id);
    if (object) object.visible = visible;
  }

  materials(): AssetMaterialEntry[] {
    if (!this.model) return [];
    const entries = new Map<string, AssetMaterialEntry>();
    this.model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const maps = [
          'map',
          'normalMap',
          'roughnessMap',
          'metalnessMap',
          'emissiveMap',
          'aoMap',
        ].filter(
          (key) =>
            key in material && Boolean((material as unknown as Record<string, unknown>)[key]),
        );
        const color =
          'color' in material && material.color instanceof THREE.Color
            ? `#${material.color.getHexString()}`
            : undefined;
        const name = material.name || 'Material';
        entries.set(`${name}:${material.type}`, {
          name,
          type: material.type,
          maps,
          ...(color ? { color } : {}),
        });
      }
    });
    return [...entries.values()];
  }

  lodLevels(): number {
    return Math.max(
      nameBasedLodLevelCount(this.nodeNames()),
      ...this.lodGroups.map((group) => group.length),
    );
  }

  setLodLevel(level: number): void {
    if (!this.model) return;
    if (this.lodGroups.length) {
      for (const group of this.lodGroups) {
        group.forEach((object, index) => {
          object.visible = index === level;
        });
      }
      return;
    }
    this.model.traverse((object) => {
      const match = /^(.*)_LOD(\d+)$/i.exec(object.name);
      if (match) object.visible = Number(match[2]) === level;
    });
  }

  setWireframe(enabled: boolean): void {
    this.model?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if ('wireframe' in material) (material as THREE.MeshBasicMaterial).wireframe = enabled;
      }
    });
  }

  dispose(): void {
    this.disposed = true;
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.clearModel();
    this.controls?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private async configureLodGroups(gltf: {
    scene: THREE.Object3D;
    parser: { getDependency(type: string, index: number): Promise<unknown> };
  }): Promise<void> {
    this.lodGroups.length = 0;
    const candidates: Array<{ root: THREE.Object3D; ids: number[] }> = [];
    gltf.scene.traverse((object) => {
      const extensions = object.userData.gltfExtensions;
      if (!isRecord(extensions) || !isRecord(extensions.MSFT_lod)) return;
      const ids = extensions.MSFT_lod.ids;
      if (Array.isArray(ids) && ids.every((id): id is number => Number.isInteger(id))) {
        candidates.push({ root: object, ids });
      }
    });
    for (const candidate of candidates) {
      const group = [candidate.root];
      for (const id of candidate.ids) {
        const node = await gltf.parser.getDependency('node', id);
        if (!(node instanceof THREE.Object3D) || node === candidate.root) continue;
        const parent = candidate.root.parent;
        if (parent) {
          node.parent?.remove(node);
          parent.add(node);
        }
        group.push(node);
      }
      if (group.length > 1) this.lodGroups.push(group);
    }
    if (this.lodGroups.length) this.setLodLevel(0);
  }

  private nodeNames(): string[] {
    const names: string[] = [];
    this.model?.traverse((object) => {
      if (object.name) names.push(object.name);
    });
    return names;
  }

  private renderFrame = (): void => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.renderFrame);
    this.mixer?.update(this.clock.getDelta());
    this.controls?.update();
    this.renderer.render(this.scene, this.camera);
  };

  private clearModel(): void {
    if (!this.model) return;
    this.scene.remove(this.model);
    disposeObject(this.model);
    this.model = undefined;
    this.mixer?.stopAllAction();
    this.mixer = undefined;
    this.animations = [];
    this.lodGroups.length = 0;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry.dispose();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}
