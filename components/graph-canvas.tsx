"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useState,
} from "react";
import dynamic from "next/dynamic";
import * as THREE from "three";
import type { ForceGraph3DInstance } from "3d-force-graph";
import type {
  GraphApiNode,
  GraphApiEdge,
  GraphConfig,
  ForceApiResponse,
  ViewType,
} from "@/lib/types";
import {
  galaxyView,
  depFlowView,
  hotspotView,
  focusView,
  moduleView,
  forcesView,
  churnView,
  coverageView,
  getModuleColor,
} from "@/lib/views";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph3D = dynamic(() => import("react-force-graph-3d") as any, {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-[#888]">
      Loading 3D graph...
    </div>
  ),
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

interface CloudEntry {
  mesh: THREE.Mesh;
  label: THREE.Sprite;
}

export function GraphCanvas({
  nodes,
  edges,
  config,
  currentView,
  focusNodeId,
  forceData,
  circularDeps,
  onNodeClick,
}: {
  nodes: GraphApiNode[];
  edges: GraphApiEdge[];
  config: GraphConfig;
  currentView: ViewType;
  focusNodeId: string | null;
  forceData: ForceApiResponse | undefined;
  circularDeps: string[][];
  onNodeClick: (node: GraphApiNode) => void;
}): React.ReactElement {
  const fgRef = useRef<ForceGraph3DInstance | undefined>(undefined);
  const cloudsRef = useRef(new Map<string, CloudEntry>());
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const graphData = useMemo(() => {
    switch (currentView) {
      case "galaxy":
        return galaxyView(nodes, edges, config);
      case "depflow":
        return depFlowView(nodes, edges, config, circularDeps);
      case "hotspot":
        return hotspotView(nodes, edges, config);
      case "focus":
        return focusView(nodes, edges, config, focusNodeId ?? (nodes[0]?.id || ""));
      case "module":
        return moduleView(nodes, edges, config, nodeById);
      case "forces":
        return forcesView(
          nodes, edges, config,
          forceData ?? { moduleCohesion: [], tensionFiles: [], bridgeFiles: [], extractionCandidates: [], summary: "" },
          nodeById,
        );
      case "churn":
        return churnView(nodes, edges, config);
      case "coverage":
        return coverageView(nodes, edges, config);
      default:
        return galaxyView(nodes, edges, config);
    }
  }, [nodes, edges, config, currentView, focusNodeId, forceData, circularDeps, nodeById]);

  // Window dimensions
  useEffect(() => {
    function handleResize(): void {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => { window.removeEventListener("resize", handleResize); };
  }, []);

  // Apply physics forces when config changes
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const charge = fg.d3Force("charge");
    if (charge && typeof charge.strength === "function") {
      charge.strength(config.charge);
    }
    const link = fg.d3Force("link");
    if (link && typeof link.distance === "function") {
      link.distance(config.distance);
    }
    fg.d3ReheatSimulation();
  }, [config.charge, config.distance]);

  // Module clouds
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    function clearClouds(): void {
      if (cloudsRef.current.size === 0 || !fg) return;
      try {
        const scene = fg.scene();
        cloudsRef.current.forEach((obj) => {
          obj.mesh.geometry.dispose();
          (obj.mesh.material as THREE.Material).dispose();
          scene.remove(obj.mesh);
          const spriteMat = obj.label.material;
          spriteMat.map?.dispose();
          spriteMat.dispose();
          scene.remove(obj.label);
        });
      } catch { /* scene destroyed */ }
      cloudsRef.current.clear();
    }

    function updateClouds(): void {
      if (!fg) return;
      if (!config.showModuleBoxes) { clearClouds(); return; }
      try {
        const scene = fg.scene();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fgNodes = fg.graphData().nodes as Array<Record<string, any>>;
        const groups = new Map<string, Array<Record<string, number | string>>>();

        fgNodes.forEach((n: Record<string, unknown>) => {
          if (n.x === undefined) return;
          const mod = (n.module as string | undefined)?.startsWith(".worktrees/")
            ? undefined
            : (n.module as string) || "unknown";
          if (!mod) return;
          if (!groups.has(mod)) groups.set(mod, []);
          groups.get(mod)?.push(n as Record<string, number | string>);
        });

        const active = new Set<string>();
        groups.forEach((moduleNodes, mod) => {
          if (moduleNodes.length < 3) return;
          active.add(mod);

          let minX = Infinity, minY = Infinity, minZ = Infinity;
          let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
          moduleNodes.forEach((n) => {
            const x = n.x as number, y = n.y as number, z = n.z as number;
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
            minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
          });

          const pad = 20;
          const rx = Math.max((maxX - minX) / 2 + pad, 12);
          const ry = Math.max((maxY - minY) / 2 + pad, 12);
          const rz = Math.max((maxZ - minZ) / 2 + pad, 12);
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const cz = (minZ + maxZ) / 2;

          const existing = cloudsRef.current.get(mod);
          if (existing) {
            existing.mesh.position.set(cx, cy, cz);
            existing.mesh.scale.set(rx, ry, rz);
            (existing.mesh.material as THREE.MeshBasicMaterial).opacity = config.boxOpacity * 0.25;
            existing.label.position.set(cx, maxY + pad + 8, cz);
          } else {
            const color = getModuleColor(mod);
            const geo = new THREE.SphereGeometry(2, 24, 16);
            const mat = new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: config.boxOpacity * 0.25,
              depthWrite: false,
              side: THREE.BackSide,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(cx, cy, cz);
            mesh.scale.set(rx, ry, rz);
            scene.add(mesh);

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = 512; canvas.height = 64;
              ctx.font = "bold 36px Inter, -apple-system, sans-serif";
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.strokeStyle = "#000";
              ctx.lineWidth = 6;
              ctx.strokeText(mod, 256, 32);
              ctx.fillStyle = "#fff";
              ctx.fillText(mod, 256, 32);
            }
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
            const label = new THREE.Sprite(spriteMat);
            label.scale.set(100, 12, 1);
            label.position.set(cx, maxY + pad + 8, cz);
            scene.add(label);

            cloudsRef.current.set(mod, { mesh, label });
          }
        });

        cloudsRef.current.forEach((obj, mod) => {
          if (!active.has(mod)) {
            obj.mesh.geometry.dispose();
            (obj.mesh.material as THREE.Material).dispose();
            scene.remove(obj.mesh);
            const spriteMat = obj.label.material;
            spriteMat.map?.dispose();
            spriteMat.dispose();
            scene.remove(obj.label);
            cloudsRef.current.delete(mod);
          }
        });
      } catch { /* error */ }
    }

    fg.onEngineTick(updateClouds);
    return () => { clearClouds(); };
  }, [config.showModuleBoxes, config.boxOpacity]);

  // Search fly: listen for custom event
  useEffect(() => {
    function handleSearchFly(e: Event): void {
      const nodeId = (e as CustomEvent<string>).detail;
      const fg = fgRef.current;
      if (!fg || !nodeId) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fgNodes = fg.graphData().nodes as Array<Record<string, any>>;
      const target = fgNodes.find((n: Record<string, unknown>) => n.id === nodeId);
      if (target?.x !== undefined) {
        fg.cameraPosition(
          { x: (target.x as number) + 100, y: (target.y as number) + 100, z: (target.z as number) + 100 },
          { x: target.x as number, y: target.y as number, z: target.z as number },
          1000,
        );
      }
    }
    window.addEventListener("search-fly", handleSearchFly);
    return () => { window.removeEventListener("search-fly", handleSearchFly); };
  }, []);

  const handleNodeClick = useCallback(
    (node: Record<string, unknown>) => {
      const apiNode = nodeById.get(node.id as string);
      if (apiNode) onNodeClick(apiNode);
    },
    [nodeById, onNodeClick],
  );

  return (
    <div className="w-screen h-screen">
      <ForceGraph3D
        ref={fgRef}
        graphData={{
          nodes: graphData.nodes.map((n) => ({ ...n })),
          links: graphData.links.map((l) => ({ ...l })),
        }}
        nodeLabel={(n: Record<string, unknown>) => `${n.path as string} (${n.loc as number} LOC)`}
        nodeColor={(n: Record<string, unknown>) => n.color as string}
        nodeVal={(n: Record<string, unknown>) => n.size as number}
        nodeOpacity={config.nodeOpacity}
        linkColor={(l: Record<string, unknown>) => l.color as string}
        linkWidth={(l: Record<string, unknown>) => l.width as number}
        linkOpacity={config.linkOpacity}
        backgroundColor="#0a0a0f"
        onNodeClick={handleNodeClick}
        dagMode={currentView === "depflow" ? "td" : undefined}
        dagLevelDistance={currentView === "depflow" ? 50 : undefined}
        width={dimensions.width}
        height={dimensions.height}
      />
    </div>
  );
}
