import { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Entity, EntityType, Relationship } from "../data/types";
import { IconMinus, IconPlus, IconTarget } from "./icons";

/* ── colour palette ── */
const typeColor: Record<EntityType, string> = {
  person: "#2563eb",
  organization: "#d97706",
  location: "#0d9488",
  vehicle: "#7c3aed",
  phone: "#e11d48",
};

const riskGlow: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#64748b",
};

const edgeTypeColor: Record<string, string> = {
  associate: "#94a3b8",
  family: "#f472b6",
  financial: "#22d3ee",
  communication: "#a78bfa",
  ownership: "#fb923c",
  frequents: "#4ade80",
  employment: "#facc15",
};

/* ── 3D force layout ── */
interface SimNode {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

function runForceLayout(
  entities: Entity[],
  relationships: Relationship[],
  iterations = 120,
): Map<string, THREE.Vector3> {
  const nodes: SimNode[] = entities.map((e) => ({
    id: e.id,
    x: (Math.random() - 0.5) * 200,
    y: (Math.random() - 0.5) * 200,
    z: (Math.random() - 0.5) * 200,
    vx: 0,
    vy: 0,
    vz: 0,
  }));

  const idx = new Map<string, number>();
  nodes.forEach((n, i) => idx.set(n.id, i));

  const REPULSION = 8000;
  const SPRING = 0.012;
  const REST = 40;
  const DAMPING = 0.88;
  const DT = 0.7;

  for (let iter = 0; iter < iterations; iter++) {
    // charge repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        const distSq = dx * dx + dy * dy + dz * dz + 1;
        const force = REPULSION / distSq;
        const dist = Math.sqrt(distSq);
        const fx = (force * dx) / dist;
        const fy = (force * dy) / dist;
        const fz = (force * dz) / dist;
        a.vx += fx;
        a.vy += fy;
        a.vz += fz;
        b.vx -= fx;
        b.vy -= fy;
        b.vz -= fz;
      }
    }

    // spring attraction
    for (const r of relationships) {
      const ai = idx.get(r.source);
      const bi = idx.get(r.target);
      if (ai === undefined || bi === undefined) continue;
      const a = nodes[ai];
      const b = nodes[bi];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = b.z - a.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;
      const displacement = dist - REST;
      const force = SPRING * displacement;
      const fx = (force * dx) / dist;
      const fy = (force * dy) / dist;
      const fz = (force * dz) / dist;
      a.vx += fx;
      a.vy += fy;
      a.vz += fz;
      b.vx -= fx;
      b.vy -= fy;
      b.vz -= fz;
    }

    // integrate
    for (const n of nodes) {
      n.vx *= DAMPING;
      n.vy *= DAMPING;
      n.vz *= DAMPING;
      n.x += n.vx * DT;
      n.y += n.vy * DT;
      n.z += n.vz * DT;
    }
  }

  const result = new Map<string, THREE.Vector3>();
  for (const n of nodes) {
    result.set(n.id, new THREE.Vector3(n.x, n.y, n.z));
  }
  return result;
}

/* ── component props ── */
interface GraphView3DProps {
  entities: Entity[];
  relationships: Relationship[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  highlightEdgeIds?: Set<string>;
  hiddenEdgeIds?: Set<string>;
  dimmedNodeIds?: Set<string>;
  nodeColorOverride?: Map<string, string>;
}

/* ── main component ── */
export default function GraphView3D({
  entities,
  relationships,
  selectedId,
  onSelect,
  highlightEdgeIds,
  hiddenEdgeIds,
  dimmedNodeIds,
  nodeColorOverride,
}: GraphView3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    cssRenderer: CSS2DRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    composer: EffectComposer;
    nodeMeshes: Map<string, THREE.Mesh>;
    edgeLines: Map<string, THREE.Line>;
    glowMeshes: Map<string, THREE.Mesh>;
    labelObjects: Map<string, CSS2DObject>;
    particleSystems: Map<string, { points: THREE.Points; progress: Float32Array; speeds: Float32Array; dirs: THREE.Vector3 }>;
    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;
    animId: number;
    positions: Map<string, THREE.Vector3>;
    tooltip: HTMLDivElement;
    hoveredId: string | null;
  } | null>(null);

  // keep a ref to the latest onSelect so the click handler never goes stale
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const cleanup = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    cancelAnimationFrame(s.animId);
    s.controls.dispose();
    s.renderer.dispose();
    s.composer.dispose();
    // remove label objects
    s.labelObjects.forEach((lbl) => {
      if (lbl.element.parentNode) lbl.element.parentNode.removeChild(lbl.element);
      lbl.removeFromParent();
    });
    // remove particle systems
    s.particleSystems.forEach((ps) => {
      ps.points.geometry.dispose();
      (ps.points.material as THREE.PointsMaterial).dispose();
    });
    s.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      const mat = (obj as THREE.Mesh).material;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else (mat as THREE.Material).dispose();
      }
    });
    if (s.renderer.domElement.parentNode) s.renderer.domElement.parentNode.removeChild(s.renderer.domElement);
    if (s.cssRenderer.domElement.parentNode) s.cssRenderer.domElement.parentNode.removeChild(s.cssRenderer.domElement);
    if (s.tooltip.parentNode) s.tooltip.parentNode.removeChild(s.tooltip);
    sceneRef.current = null;
  }, []);

  /* ── build scene whenever entities/relationships change ── */
  useEffect(() => {
    cleanup();
    const container = mountRef.current;
    if (!container || entities.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // ── renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ── CSS2D renderer for labels ──
    const cssRenderer = new CSS2DRenderer();
    cssRenderer.setSize(width, height);
    cssRenderer.domElement.style.position = "absolute";
    cssRenderer.domElement.style.top = "0";
    cssRenderer.domElement.style.left = "0";
    cssRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(cssRenderer.domElement);

    // ── scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0e1a");

    // subtle ambient grid of particles
    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 600;
    const starPositions = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i++) starPositions[i] = (Math.random() - 0.5) * 800;
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({ color: "#1e293b", size: 1.2, transparent: true, opacity: 0.5 });
    scene.add(new THREE.Points(starsGeo, starsMat));

    // ── camera ──
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 2000);
    camera.position.set(0, 0, 280);

    // ── lights ──
    scene.add(new THREE.AmbientLight("#334155", 1.8));
    const dirLight = new THREE.DirectionalLight("#e2e8f0", 0.6);
    dirLight.position.set(50, 100, 80);
    scene.add(dirLight);

    // ── controls ──
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 30;
    controls.maxDistance = 800;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;

    // ── post-processing ──
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.4, 0.7);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ── tooltip ──
    const tooltip = document.createElement("div");
    tooltip.className = "graph3d-tooltip";
    tooltip.style.display = "none";
    container.appendChild(tooltip);

    // ── layout ──
    const positions = runForceLayout(entities, relationships);

    // compute degree
    const degree = new Map<string, number>();
    relationships.forEach((r) => {
      degree.set(r.source, (degree.get(r.source) ?? 0) + 1);
      degree.set(r.target, (degree.get(r.target) ?? 0) + 1);
    });

    // ── nodes ──
    const nodeMeshes = new Map<string, THREE.Mesh>();
    const glowMeshes = new Map<string, THREE.Mesh>();
    const labelObjects = new Map<string, CSS2DObject>();

    for (const e of entities) {
      const pos = positions.get(e.id)!;
      const d = degree.get(e.id) ?? 0;
      const baseRadius = 2.2 + Math.min(d, 10) * 0.5;
      const color = nodeColorOverride?.get(e.id) ?? typeColor[e.type];

      // core sphere
      const geo = new THREE.SphereGeometry(baseRadius, 24, 24);
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.4,
        transparent: true,
        opacity: dimmedNodeIds?.has(e.id) ? 0.12 : 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData = { entityId: e.id };
      scene.add(mesh);
      nodeMeshes.set(e.id, mesh);

      // risk glow halo
      const glowRadius = baseRadius * 1.8;
      const glowGeo = new THREE.SphereGeometry(glowRadius, 16, 16);
      const glowColor = riskGlow[e.riskLevel];
      const glowMat = new THREE.MeshBasicMaterial({
        color: glowColor,
        transparent: true,
        opacity: e.riskLevel === "high" ? 0.18 : e.riskLevel === "medium" ? 0.1 : 0.04,
        side: THREE.BackSide,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.copy(pos);
      if (dimmedNodeIds?.has(e.id)) glowMat.opacity = 0.02;
      scene.add(glowMesh);
      glowMeshes.set(e.id, glowMesh);

      // CSS2D label
      const labelDiv = document.createElement("div");
      labelDiv.className = "graph3d-label";
      labelDiv.textContent = e.label;
      labelDiv.style.color = color;
      if (dimmedNodeIds?.has(e.id)) labelDiv.style.opacity = "0.15";
      const labelObj = new CSS2DObject(labelDiv);
      labelObj.position.set(0, baseRadius + 3, 0);
      mesh.add(labelObj);
      labelObjects.set(e.id, labelObj);
    }

    // ── edges ──
    const edgeLines = new Map<string, THREE.Line>();
    const particleSystems = new Map<string, { points: THREE.Points; progress: Float32Array; speeds: Float32Array; dirs: THREE.Vector3 }>();

    for (const r of relationships) {
      const from = positions.get(r.source);
      const to = positions.get(r.target);
      if (!from || !to) continue;

      const isHighlighted = highlightEdgeIds?.has(r.id) ?? false;
      const isHidden = hiddenEdgeIds?.has(r.id) ?? false;

      const lineColor = isHighlighted ? "#f97316" : (edgeTypeColor[r.type] ?? "#475569");
      const lineWidth = 1; // WebGL lines are always 1px, we use linebasicmaterial
      const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
      const mat = new THREE.LineBasicMaterial({
        color: lineColor,
        transparent: true,
        opacity: isHidden ? 0 : isHighlighted ? 0.95 : 0.25 + Math.min(r.weight, 10) * 0.04,
        linewidth: lineWidth,
      });
      const line = new THREE.Line(geo, mat);
      line.userData = { relId: r.id };
      scene.add(line);
      edgeLines.set(r.id, line);

      // ── animated particles along edge ──
      if (!isHidden && r.weight >= 2) {
        const particleCount = Math.min(r.weight, 8);
        const pGeo = new THREE.BufferGeometry();
        const pPositions = new Float32Array(particleCount * 3);
        const progress = new Float32Array(particleCount);
        const speeds = new Float32Array(particleCount);
        const dir = new THREE.Vector3().subVectors(to, from);

        for (let i = 0; i < particleCount; i++) {
          progress[i] = Math.random();
          speeds[i] = 0.002 + Math.random() * 0.003;
          const p = new THREE.Vector3().copy(from).addScaledVector(dir, progress[i]);
          pPositions[i * 3] = p.x;
          pPositions[i * 3 + 1] = p.y;
          pPositions[i * 3 + 2] = p.z;
        }

        pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
        const pMat = new THREE.PointsMaterial({
          color: lineColor,
          size: isHighlighted ? 2.5 : 1.5,
          transparent: true,
          opacity: isHighlighted ? 0.9 : 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const points = new THREE.Points(pGeo, pMat);
        scene.add(points);
        particleSystems.set(r.id, { points, progress, speeds, dirs: dir });
      }
    }

    // ── selection ring ──
    const selectionRingGeo = new THREE.RingGeometry(0.9, 1.1, 32);
    const selectionRingMat = new THREE.MeshBasicMaterial({
      color: "#fbbf24",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const selectionRing = new THREE.Mesh(selectionRingGeo, selectionRingMat);
    selectionRing.visible = false;
    scene.add(selectionRing);

    if (selectedId) {
      const mesh = nodeMeshes.get(selectedId);
      if (mesh) {
        const radius = (mesh.geometry as THREE.SphereGeometry).parameters.radius;
        selectionRing.scale.set(radius * 1.6, radius * 1.6, 1);
        selectionRing.position.copy(mesh.position);
        selectionRing.visible = true;
      }
    }

    // ── raycasting ──
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredId: string | null = null;

    function onMouseMove(e: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function onClick() {
      raycaster.setFromCamera(mouse, camera);
      const allMeshes = [...nodeMeshes.values()];
      const hits = raycaster.intersectObjects(allMeshes);
      if (hits.length > 0) {
        const id = hits[0].object.userData.entityId as string;
        onSelectRef.current(id);
      } else {
        onSelectRef.current(null);
      }
    }

    renderer.domElement.addEventListener("mousemove", onMouseMove);
    renderer.domElement.addEventListener("click", onClick);

    // stop auto-rotate on interaction
    renderer.domElement.addEventListener("pointerdown", () => {
      controls.autoRotate = false;
    });

    // ── resize ──
    function onResize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      cssRenderer.setSize(w, h);
      composer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);
    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(container);

    // ── animation loop ──
    const clock = new THREE.Clock();
    let animId = 0;

    function animate() {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();
      controls.update();

      // gentle node breathing
      nodeMeshes.forEach((mesh) => {
        const base = (mesh.geometry as THREE.SphereGeometry).parameters.radius;
        const breathe = 1 + Math.sin(elapsed * 1.5 + mesh.position.x * 0.1) * 0.03;
        mesh.scale.setScalar(breathe);
      });

      // selection ring rotation
      if (selectionRing.visible) {
        selectionRing.lookAt(camera.position);
        selectionRingMat.opacity = 0.5 + Math.sin(elapsed * 3) * 0.35;
      }

      // animate particles
      particleSystems.forEach((ps) => {
        const posAttr = ps.points.geometry.getAttribute("position") as THREE.BufferAttribute;
        const from = new THREE.Vector3(
          posAttr.getX(0) - ps.dirs.x * ps.progress[0],
          posAttr.getY(0) - ps.dirs.y * ps.progress[0],
          posAttr.getZ(0) - ps.dirs.z * ps.progress[0],
        );
        // we need to calculate from base: from the edge start
        // But we stored dirs as (to - from), so edge_start = position - dirs * progress
        // Actually, let's recompute from the line endpoints
        for (let i = 0; i < ps.progress.length; i++) {
          ps.progress[i] += ps.speeds[i];
          if (ps.progress[i] > 1) ps.progress[i] -= 1;
        }
        // recompute positions by finding start position from first particle
        // Edge start = line start. We stored dirs = to - from, and positions as from + dirs*progress.
        // So we need the 'from' position. Let's just get it from the first particle's init.
        // We'll store edge start on the ps object — but we didn't. Let's infer it:
        // Actually, easier: use the edge line geometry
        const entry = ps as typeof ps & { _from?: THREE.Vector3 };
        if (!entry._from) {
          // compute it from the first particle's original placement equation
          // We know: pPos[0] was = from + dirs * progress[0]_original. But that's lost.
          // Instead just grab from the line's geometry:
          entry._from = new THREE.Vector3();
          // find the corresponding line
          edgeLines.forEach((line, relId) => {
            if (particleSystems.get(relId) === ps) {
              const linePos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
              entry._from!.set(linePos.getX(0), linePos.getY(0), linePos.getZ(0));
            }
          });
        }

        for (let i = 0; i < ps.progress.length; i++) {
          const px = entry._from!.x + ps.dirs.x * ps.progress[i];
          const py = entry._from!.y + ps.dirs.y * ps.progress[i];
          const pz = entry._from!.z + ps.dirs.z * ps.progress[i];
          posAttr.setXYZ(i, px, py, pz);
        }
        posAttr.needsUpdate = true;
      });

      // hover detection
      raycaster.setFromCamera(mouse, camera);
      const allMeshes = [...nodeMeshes.values()];
      const hits = raycaster.intersectObjects(allMeshes);
      if (hits.length > 0) {
        const id = hits[0].object.userData.entityId as string;
        if (hoveredId !== id) {
          hoveredId = id;
          const ent = entities.find((e) => e.id === id);
          tooltip.innerHTML = `<strong>${ent?.label ?? id}</strong><br/><span style="text-transform:capitalize">${ent?.type ?? ""}</span>`;
          tooltip.style.display = "block";
          renderer.domElement.style.cursor = "pointer";
        }
        // position tooltip near mouse
        const rect = renderer.domElement.getBoundingClientRect();
        tooltip.style.left = `${((mouse.x + 1) / 2) * rect.width + 14}px`;
        tooltip.style.top = `${((-mouse.y + 1) / 2) * rect.height - 10}px`;
      } else {
        if (hoveredId) {
          hoveredId = null;
          tooltip.style.display = "none";
          renderer.domElement.style.cursor = "grab";
        }
      }

      composer.render();
      cssRenderer.render(scene, camera);
    }

    animate();

    sceneRef.current = {
      renderer,
      cssRenderer,
      scene,
      camera,
      controls,
      composer,
      nodeMeshes,
      edgeLines,
      glowMeshes,
      labelObjects,
      particleSystems,
      raycaster,
      mouse,
      animId,
      positions,
      tooltip,
      hoveredId,
    };

    return () => {
      window.removeEventListener("resize", onResize);
      resizeObs.disconnect();
      renderer.domElement.removeEventListener("mousemove", onMouseMove);
      renderer.domElement.removeEventListener("click", onClick);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, relationships]);

  /* ── live prop updates without full rebuild ── */

  // selection ring
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    // find old selection ring
    s.scene.children.forEach((child) => {
      if ((child as THREE.Mesh).geometry?.type === "RingGeometry") {
        if (selectedId) {
          const mesh = s.nodeMeshes.get(selectedId);
          if (mesh) {
            const radius = (mesh.geometry as THREE.SphereGeometry).parameters.radius;
            child.scale.set(radius * 1.6, radius * 1.6, 1);
            child.position.copy(mesh.position);
            child.visible = true;
          }
        } else {
          child.visible = false;
        }
      }
    });
  }, [selectedId]);

  // dimmed nodes
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.nodeMeshes.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.opacity = dimmedNodeIds?.has(id) ? 0.12 : 1;
      const lbl = s.labelObjects.get(id);
      if (lbl) (lbl.element as HTMLDivElement).style.opacity = dimmedNodeIds?.has(id) ? "0.15" : "1";
      const glow = s.glowMeshes.get(id);
      if (glow) (glow.material as THREE.MeshBasicMaterial).opacity = dimmedNodeIds?.has(id) ? 0.02 : 0.12;
    });
  }, [dimmedNodeIds]);

  // community colour override
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    entities.forEach((e) => {
      const override = nodeColorOverride?.get(e.id);
      const color = override ?? typeColor[e.type];
      const mesh = s.nodeMeshes.get(e.id);
      if (mesh) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mat.color.set(color);
        mat.emissive.set(color);
      }
      const lbl = s.labelObjects.get(e.id);
      if (lbl) (lbl.element as HTMLDivElement).style.color = color;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeColorOverride]);

  // hidden edges
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.edgeLines.forEach((line, id) => {
      const mat = line.material as THREE.LineBasicMaterial;
      const isHidden = hiddenEdgeIds?.has(id) ?? false;
      mat.opacity = isHidden ? 0 : 0.35;
      const ps = s.particleSystems.get(id);
      if (ps) ps.points.visible = !isHidden;
    });
  }, [hiddenEdgeIds]);

  // highlighted edges
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    relationships.forEach((r) => {
      const line = s.edgeLines.get(r.id);
      if (!line) return;
      const mat = line.material as THREE.LineBasicMaterial;
      const isHighlighted = highlightEdgeIds?.has(r.id) ?? false;
      const isHidden = hiddenEdgeIds?.has(r.id) ?? false;
      mat.color.set(isHighlighted ? "#f97316" : (edgeTypeColor[r.type] ?? "#475569"));
      mat.opacity = isHidden ? 0 : isHighlighted ? 0.95 : 0.25 + Math.min(r.weight, 10) * 0.04;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightEdgeIds]);

  /* ── zoom helpers ── */
  function recenter() {
    const s = sceneRef.current;
    if (!s) return;
    s.controls.reset();
    s.camera.position.set(0, 0, 280);
    s.controls.update();
  }

  function zoomBy(factor: number) {
    const s = sceneRef.current;
    if (!s) return;
    s.camera.position.multiplyScalar(1 / factor);
    s.controls.update();
  }

  return (
    <>
      <div ref={mountRef} className="graph3d-container" style={{ width: "100%", height: "100%", position: "relative" }} />
      <div className="icon-dock icon-dock-bottom-left">
        <button className="icon-dock-btn" onClick={recenter} aria-label="Recenter graph">
          <IconTarget />
        </button>
        <button className="icon-dock-btn" onClick={() => zoomBy(1.3)} aria-label="Zoom in">
          <IconPlus />
        </button>
        <button className="icon-dock-btn" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">
          <IconMinus />
        </button>
      </div>
    </>
  );
}
