import React, { useEffect, useRef, useState } from 'react';
import type { AssetPreview } from '@gamecrafter/contracts';
import { ThreeViewer, type AssetHierarchyEntry, type AssetMaterialEntry } from './three-viewer';

export interface AssetViewerProps {
  url: string;
  preview: AssetPreview;
  onOpenInAuthoringTool(): void;
}

export function AssetViewer({
  url,
  preview,
  onOpenInAuthoringTool,
}: AssetViewerProps): React.ReactElement {
  const host = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ThreeViewer | undefined>(undefined);
  const [error, setError] = useState<string>();
  const [activeTab, setActiveTab] = useState<'Hierarchy' | 'Materials' | 'Info'>('Hierarchy');
  const [hierarchy, setHierarchy] = useState<AssetHierarchyEntry[]>([]);
  const [materials, setMaterials] = useState<AssetMaterialEntry[]>([]);
  const [animations, setAnimations] = useState<string[]>([]);
  const [selectedAnimation, setSelectedAnimation] = useState('');
  const [paused, setPaused] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [lodLevel, setLodLevel] = useState(0);
  const lodLevels = Math.max(viewerRef.current?.lodLevels() ?? 0, preview.metadata.lodLevels ?? 0);

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let viewer: ThreeViewer;
    try {
      viewer = new ThreeViewer(element);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'WebGL preview is unavailable.');
      return;
    }
    viewerRef.current = viewer;
    setError(undefined);
    void viewer
      .load(url)
      .then(() => {
        setAnimations(viewer.listAnimations());
        setHierarchy(viewer.hierarchy());
        setMaterials(viewer.materials());
        setPaused(true);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : 'Could not load this model preview.');
      });
    const observer = new ResizeObserver(() => viewer.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      viewer.dispose();
      if (viewerRef.current === viewer) viewerRef.current = undefined;
    };
  }, [url]);

  const refreshInspector = (): void => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    setHierarchy(viewer.hierarchy());
    setMaterials(viewer.materials());
  };

  return (
    <div className="gamecrafter-asset-viewer">
      <div
        className="gamecrafter-asset-viewer-toolbar"
        role="toolbar"
        aria-label="3D viewer controls"
      >
        <button type="button" onClick={() => viewerRef.current?.frameAll()}>
          Frame
        </button>
        <button type="button" onClick={() => viewerRef.current?.resetCamera()}>
          Reset camera
        </button>
        <button
          type="button"
          aria-pressed={wireframe}
          onClick={() => {
            const next = !wireframe;
            viewerRef.current?.setWireframe(next);
            setWireframe(next);
          }}
        >
          {wireframe ? 'Solid' : 'Wireframe'}
        </button>
        <label>
          Animation
          <select
            aria-label="Animation"
            value={selectedAnimation}
            onChange={(event) => {
              const name = event.currentTarget.value;
              setSelectedAnimation(name);
              viewerRef.current?.playAnimation(name || null);
              setPaused(!name);
            }}
          >
            <option value="">None</option>
            {animations.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!selectedAnimation}
          onClick={() => {
            const next = !paused;
            viewerRef.current?.setPaused(next);
            setPaused(next);
          }}
        >
          {paused ? 'Play' : 'Pause'}
        </button>
        <label>
          LOD
          <select
            aria-label="LOD level"
            disabled={!lodLevels}
            value={lodLevels ? lodLevel : ''}
            onChange={(event) => {
              const next = Number(event.currentTarget.value);
              viewerRef.current?.setLodLevel(next);
              setLodLevel(next);
              refreshInspector();
            }}
          >
            {lodLevels ? (
              Array.from({ length: lodLevels }, (_, index) => (
                <option key={index} value={index}>
                  {index}
                </option>
              ))
            ) : (
              <option value="">No LOD levels in this asset</option>
            )}
          </select>
        </label>
      </div>
      {error && (
        <p className="gamecrafter-assets-error" role="alert">
          {error}
        </p>
      )}
      <div ref={host} className="gamecrafter-asset-viewer-canvas" aria-label="3D model viewer" />
      <div className="gamecrafter-asset-viewer-tabs" role="tablist" aria-label="Asset inspection">
        {(['Hierarchy', 'Materials', 'Info'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <section className="gamecrafter-asset-viewer-inspector">
        {activeTab === 'Hierarchy' &&
          (hierarchy.length ? (
            hierarchy.map((node) => (
              <label
                className="gamecrafter-asset-hierarchy-node"
                key={node.id}
                style={{ paddingLeft: `${node.depth * 14}px` }}
              >
                <input
                  type="checkbox"
                  checked={node.visible}
                  onChange={(event) => {
                    viewerRef.current?.setNodeVisible(node.id, event.currentTarget.checked);
                    refreshInspector();
                  }}
                />
                <span>{node.name}</span>
                <small>{node.type}</small>
              </label>
            ))
          ) : (
            <p>No hierarchy data.</p>
          ))}
        {activeTab === 'Materials' &&
          (materials.length ? (
            materials.map((material) => (
              <div className="gamecrafter-asset-material" key={`${material.name}:${material.type}`}>
                <strong>{material.name}</strong>
                <span>
                  {material.type}
                  {material.color ? ` · ${material.color}` : ''}
                </span>
                <small>{material.maps.length ? material.maps.join(', ') : 'No texture maps'}</small>
              </div>
            ))
          ) : (
            <p>No materials.</p>
          ))}
        {activeTab === 'Info' && (
          <div className="gamecrafter-asset-info">
            <p>
              <strong>Source</strong> {preview.sourcePath}
            </p>
            <p>
              <strong>glTF</strong> {preview.metadata.gltfVersion ?? 'unknown'}
            </p>
            <p>
              <strong>Nodes</strong> {preview.metadata.nodes ?? 0} · <strong>Meshes</strong>{' '}
              {preview.metadata.meshes ?? 0}
            </p>
            <p>
              <strong>Materials</strong> {preview.metadata.materials ?? 0} ·{' '}
              <strong>Textures</strong> {preview.metadata.textures ?? 0}
            </p>
            {preview.warnings.map((warning) => (
              <p className="gamecrafter-assets-warning" key={warning}>
                {warning}
              </p>
            ))}
            <button type="button" onClick={onOpenInAuthoringTool}>
              Open in authoring tool
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
