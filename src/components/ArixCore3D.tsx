import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ArixLiveStatus, ArixSatelliteKey } from '../types/arix';

interface ArixCore3DProps {
  liveStatus: ArixLiveStatus;
  connectedCount: number;
  activeRuleCount: number;
  onSelectSatellite?: (node: ArixSatelliteKey) => void;
}

interface SatelliteMeta {
  key: ArixSatelliteKey;
  label: string;
  subLabel: string;
  basePos: [number, number, number];
  phase: number;
}

const SATELLITES: SatelliteMeta[] = [
  {
    key: 'text',
    label: 'Teach & UX',
    subLabel: 'Memory · Audits',
    basePos: [-3.45, 1.85, 0.2],
    phase: 0.2,
  },
  {
    key: 'compute',
    label: 'Computer & CF',
    subLabel: 'Files · Cloudflare',
    basePos: [-4.05, -0.05, 0.55],
    phase: 1.7,
  },
  {
    key: 'code',
    label: 'GitHub & Code',
    subLabel: 'Repos · Websites',
    basePos: [-3.35, -1.9, 0.15],
    phase: 3.1,
  },
  {
    key: 'network',
    label: 'Telegram',
    subLabel: 'Bot · Alerts',
    basePos: [4.05, 1.7, -0.35],
    phase: 4.4,
  },
];

function createGlowDotTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(224, 252, 255, 1)');
    grad.addColorStop(0.28, 'rgba(56, 224, 255, 0.92)');
    grad.addColorStop(0.65, 'rgba(14, 165, 233, 0.28)');
    grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createCoreEmblemTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 512, 512);
    const halo = ctx.createRadialGradient(256, 256, 20, 256, 256, 210);
    halo.addColorStop(0, 'rgba(34, 211, 238, 0.34)');
    halo.addColorStop(0.55, 'rgba(14, 165, 233, 0.12)');
    halo.addColorStop(1, 'rgba(6, 14, 31, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 512, 512);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(56, 224, 255, 0.85)';
    ctx.shadowBlur = 24;
    const textGrad = ctx.createLinearGradient(0, 175, 0, 315);
    textGrad.addColorStop(0, '#ffffff');
    textGrad.addColorStop(0.55, '#d8f6ff');
    textGrad.addColorStop(1, '#7dd3fc');
    ctx.fillStyle = textGrad;
    ctx.font = '800 156px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('AI', 256, 242);

    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(165, 243, 252, 0.92)';
    ctx.font = '700 32px "JetBrains Mono", monospace';
    ctx.fillText('ARIX', 256, 338);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createSatelliteIconTexture(key: ArixSatelliteKey): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);
    const halo = ctx.createRadialGradient(128, 128, 8, 128, 128, 96);
    halo.addColorStop(0, 'rgba(56, 224, 255, 0.38)');
    halo.addColorStop(1, 'rgba(6, 14, 31, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = '#d6fbff';
    ctx.fillStyle = '#d6fbff';
    ctx.shadowColor = 'rgba(34, 211, 238, 0.9)';
    ctx.shadowBlur = 16;

    if (key === 'text') {
      ctx.font = '800 104px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', 128, 132);
    } else if (key === 'code') {
      ctx.font = '700 72px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('</>', 128, 130);
    } else if (key === 'compute') {
      // Clean stylized microchip matching image 2
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(88, 88, 80, 80, 12);
      ctx.fillStyle = 'rgba(165, 243, 252, 0.95)';
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#a5f3fc';
      ctx.lineWidth = 6;
      const offsets = [102, 119, 137, 154];
      for (const o of offsets) {
        ctx.beginPath();
        ctx.moveTo(o, 68);
        ctx.lineTo(o, 88);
        ctx.moveTo(o, 168);
        ctx.lineTo(o, 188);
        ctx.moveTo(68, o);
        ctx.lineTo(88, o);
        ctx.moveTo(168, o);
        ctx.lineTo(188, o);
        ctx.stroke();
      }
      ctx.fillStyle = '#072244';
      ctx.beginPath();
      ctx.roundRect(108, 108, 40, 40, 6);
      ctx.fill();
    } else {
      // Network / Telegram plane icon
      ctx.lineWidth = 7;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(176, 84);
      ctx.lineTo(74, 126);
      ctx.lineTo(116, 142);
      ctx.lineTo(156, 168);
      ctx.closePath();
      ctx.fillStyle = 'rgba(214, 251, 255, 0.95)';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(116, 142);
      ctx.lineTo(176, 84);
      ctx.strokeStyle = '#072244';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function detectSoftwareGl(renderer: THREE.WebGLRenderer): boolean {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const str = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(str);
    }
  } catch {
    // Ignore probe errors
  }
  return false;
}

export function ArixCore3D({
  liveStatus,
  connectedCount,
  activeRuleCount,
  onSelectSatellite,
}: ArixCore3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const liveStatusRef = useRef(liveStatus);
  const onSelectRef = useRef(onSelectSatellite);

  const [fallbackImage, setFallbackImage] = useState(false);

  useEffect(() => {
    liveStatusRef.current = liveStatus;
  }, [liveStatus]);

  useEffect(() => {
    onSelectRef.current = onSelectSatellite;
  }, [onSelectSatellite]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setFallbackImage(true);
      return;
    }

    const isSoftwareGl = detectSoftwareGl(renderer);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      0.1,
      100
    );
    camera.position.set(0, 0, 11.4);

    const disposables: Array<{ dispose: () => void }> = [];

    const dotTexture = createGlowDotTexture();
    const coreEmblemTex = createCoreEmblemTexture();
    disposables.push(dotTexture, coreEmblemTex);

    // Master parallax group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Background subtle starfield & neural web lattice
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 24;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      starPositions[i * 3 + 2] = -3.5 - Math.random() * 8;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.12,
      map: dotTexture,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0x38bdf8,
    });
    const stars = new THREE.Points(starGeo, starMat);
    rootGroup.add(stars);
    disposables.push(starGeo, starMat);

    // Subtle background wireframe wave mesh (echoing top-right mesh in user images)
    const bgWaveGeo = new THREE.IcosahedronGeometry(3.2, 2);
    const bgWaveMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const bgWaveMesh = new THREE.Mesh(bgWaveGeo, bgWaveMat);
    bgWaveMesh.position.set(4.8, 3.3, -4.6);
    bgWaveMesh.scale.set(1.5, 0.9, 1.0);
    rootGroup.add(bgWaveMesh);
    disposables.push(bgWaveGeo, bgWaveMat);

    // 2. Central AI / ARIX Sphere Group
    const coreGroup = new THREE.Group();
    coreGroup.position.set(1.25, 0, 0);
    rootGroup.add(coreGroup);

    // Dotted Fibonacci sphere shell
    const coreDotCount = 1400;
    const coreBaseDirs = new Float32Array(coreDotCount * 3);
    const coreDotPositions = new Float32Array(coreDotCount * 3);
    const coreDotColors = new Float32Array(coreDotCount * 3);
    const coreRadius = 2.18;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const colA = new THREE.Color(0x00e5ff);
    const colB = new THREE.Color(0x7dd3fc);
    const tmpCol = new THREE.Color();

    for (let i = 0; i < coreDotCount; i++) {
      const y = 1 - (i / (coreDotCount - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      coreBaseDirs[i * 3] = x;
      coreBaseDirs[i * 3 + 1] = y;
      coreBaseDirs[i * 3 + 2] = z;

      coreDotPositions[i * 3] = x * coreRadius;
      coreDotPositions[i * 3 + 1] = y * coreRadius;
      coreDotPositions[i * 3 + 2] = z * coreRadius;

      tmpCol.lerpColors(colA, colB, (y + 1) * 0.5);
      coreDotColors[i * 3] = tmpCol.r;
      coreDotColors[i * 3 + 1] = tmpCol.g;
      coreDotColors[i * 3 + 2] = tmpCol.b;
    }

    const coreDotsGeo = new THREE.BufferGeometry();
    const corePosAttr = new THREE.BufferAttribute(coreDotPositions, 3);
    coreDotsGeo.setAttribute('position', corePosAttr);
    coreDotsGeo.setAttribute(
      'color',
      new THREE.BufferAttribute(coreDotColors, 3)
    );
    const coreDotsMat = new THREE.PointsMaterial({
      size: 0.145,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const corePoints = new THREE.Points(coreDotsGeo, coreDotsMat);
    coreGroup.add(corePoints);
    disposables.push(coreDotsGeo, coreDotsMat);

    // Inner geodesic wireframe shell
    const coreWireGeo = new THREE.IcosahedronGeometry(1.94, 2);
    const coreWireMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
    });
    const coreWireMesh = new THREE.Mesh(coreWireGeo, coreWireMat);
    coreGroup.add(coreWireMesh);
    disposables.push(coreWireGeo, coreWireMat);

    // Central "AI / ARIX" sprite
    const emblemMat = new THREE.SpriteMaterial({
      map: coreEmblemTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const emblemSprite = new THREE.Sprite(emblemMat);
    emblemSprite.scale.set(2.85, 2.85, 1);
    emblemSprite.position.set(0, 0, 0.35);
    coreGroup.add(emblemSprite);
    disposables.push(emblemMat);

    // Orbital glowing rings + comet energy orbs around Core
    interface OrbitalRingObj {
      group: THREE.Group;
      comet: THREE.Mesh;
      rx: number;
      rz: number;
      speed: number;
      phase: number;
    }
    const orbitalRings: OrbitalRingObj[] = [];
    const ringConfigs = [
      { rx: 2.55, rz: 2.45, tiltX: 1.24, tiltY: 0.22, speed: 1.45, phase: 0 },
      { rx: 2.75, rz: 2.38, tiltX: -1.12, tiltY: 0.55, speed: -1.15, phase: 2.1 },
      { rx: 2.42, rz: 2.68, tiltX: 0.42, tiltY: -0.95, speed: 0.92, phase: 4.1 },
    ];
    const cometGeo = new THREE.SphereGeometry(0.085, 12, 12);
    const cometMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.96,
    });
    disposables.push(cometGeo, cometMat);

    for (const rc of ringConfigs) {
      const rGroup = new THREE.Group();
      rGroup.rotation.set(rc.tiltX, rc.tiltY, 0);
      const segments = 80;
      const ringPts = new Float32Array((segments + 1) * 3);
      for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        ringPts[i * 3] = Math.cos(a) * rc.rx;
        ringPts[i * 3 + 1] = 0;
        ringPts[i * 3 + 2] = Math.sin(a) * rc.rz;
      }
      const rGeo = new THREE.BufferGeometry();
      rGeo.setAttribute('position', new THREE.BufferAttribute(ringPts, 3));
      const rMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.36,
      });
      const rLine = new THREE.Line(rGeo, rMat);
      rGroup.add(rLine);

      const comet = new THREE.Mesh(cometGeo, cometMat);
      rGroup.add(comet);
      coreGroup.add(rGroup);
      disposables.push(rGeo, rMat);
      orbitalRings.push({
        group: rGroup,
        comet,
        rx: rc.rx,
        rz: rc.rz,
        speed: rc.speed,
        phase: rc.phase,
      });
    }

    // 3. Orbiting Wireframe Satellite Spheres + Neural Connections
    interface SatObj {
      meta: SatelliteMeta;
      group: THREE.Group;
      wireMesh: THREE.Mesh;
      wireMat: THREE.MeshBasicMaterial;
      innerMesh: THREE.Mesh;
      innerMat: THREE.MeshBasicMaterial;
      iconSprite: THREE.Sprite;
      beamLine: THREE.Line;
      beamMat: THREE.LineBasicMaterial;
      beamPosAttr: THREE.BufferAttribute;
      pulseMesh: THREE.Mesh;
      pulseMat: THREE.MeshBasicMaterial;
      currentScale: number;
      pulseProgress: number;
    }

    const satWireGeo = new THREE.IcosahedronGeometry(0.68, 1);
    const satInnerGeo = new THREE.SphereGeometry(0.46, 16, 16);
    const pulseSphereGeo = new THREE.SphereGeometry(0.08, 10, 10);
    disposables.push(satWireGeo, satInnerGeo, pulseSphereGeo);

    const satObjs: SatObj[] = SATELLITES.map((meta) => {
      const group = new THREE.Group();
      group.position.set(meta.basePos[0], meta.basePos[1], meta.basePos[2]);
      group.userData = { satelliteKey: meta.key };

      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        wireframe: true,
        transparent: true,
        opacity: 0.62,
      });
      const wireMesh = new THREE.Mesh(satWireGeo, wireMat);
      wireMesh.userData = { satelliteKey: meta.key };
      group.add(wireMesh);

      const innerMat = new THREE.MeshBasicMaterial({
        color: 0x0c4a6e,
        transparent: true,
        opacity: 0.25,
      });
      const innerMesh = new THREE.Mesh(satInnerGeo, innerMat);
      innerMesh.userData = { satelliteKey: meta.key };
      group.add(innerMesh);

      const iconTex = createSatelliteIconTexture(meta.key);
      const iconMat = new THREE.SpriteMaterial({
        map: iconTex,
        transparent: true,
        depthWrite: false,
      });
      const iconSprite = new THREE.Sprite(iconMat);
      iconSprite.scale.set(0.92, 0.92, 1);
      iconSprite.userData = { satelliteKey: meta.key };
      group.add(iconSprite);

      // Connecting filament line from Core to Satellite
      const beamPts = new Float32Array(6);
      const beamGeo = new THREE.BufferGeometry();
      const beamPosAttr = new THREE.BufferAttribute(beamPts, 3);
      beamGeo.setAttribute('position', beamPosAttr);
      const beamMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.28,
      });
      const beamLine = new THREE.Line(beamGeo, beamMat);

      // Data pulse sphere traveling on the filament
      const pulseMat = new THREE.MeshBasicMaterial({
        color: 0xa5f3fc,
        transparent: true,
        opacity: 0.85,
      });
      const pulseMesh = new THREE.Mesh(pulseSphereGeo, pulseMat);

      rootGroup.add(group);
      rootGroup.add(beamLine);
      rootGroup.add(pulseMesh);

      disposables.push(
        wireMat,
        innerMat,
        iconTex,
        iconMat,
        beamGeo,
        beamMat,
        pulseMat
      );

      return {
        meta,
        group,
        wireMesh,
        wireMat,
        innerMesh,
        innerMat,
        iconSprite,
        beamLine,
        beamMat,
        beamPosAttr,
        pulseMesh,
        pulseMat,
        currentScale: 1,
        pulseProgress: Math.random(),
      };
    });

    // Cross-filament web connecting adjacent satellites (matching image 2)
    const webPairs: Array<[number, number]> = [
      [0, 1],
      [1, 2],
      [0, 2],
    ];
    const webLines = webPairs.map(([aIdx, bIdx]) => {
      const pts = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(pts, 3);
      geo.setAttribute('position', attr);
      const mat = new THREE.LineBasicMaterial({
        color: 0x0ea5e9,
        transparent: true,
        opacity: 0.18,
      });
      const line = new THREE.Line(geo, mat);
      rootGroup.add(line);
      disposables.push(geo, mat);
      return { aIdx, bIdx, attr };
    });

    // Pointer interactivity & raycasting
    let pointerX = 0;
    let pointerY = 0;
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(
        satObjs.map((s) => s.group),
        true
      );
      if (hits.length > 0) {
        const key = hits[0].object.userData?.satelliteKey as
          | ArixSatelliteKey
          | undefined;
        if (key && onSelectRef.current) {
          onSelectRef.current(key);
        }
      }
    };

    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('click', handleClick);

    // ResizeObserver for crisp layout adaptation
    let viewportW = Math.max(1, container.clientWidth);
    let viewportH = Math.max(1, container.clientHeight);
    const updateSize = () => {
      viewportW = Math.max(1, container.clientWidth);
      viewportH = Math.max(1, container.clientHeight);
      camera.aspect = viewportW / viewportH;
      // Pull camera slightly further on narrow viewports so all satellites fit nicely
      camera.position.z = viewportW < 640 ? 14.2 : 11.4;
      camera.updateProjectionMatrix();
      renderer.setSize(viewportW, viewportH, false);
    };
    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    // WebGL Context Loss handling
    let contextLost = false;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
    };
    const onContextRestored = () => {
      contextLost = false;
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    // Pre-allocated scratch variables (zero per-frame GC churn)
    const tmpWorld = new THREE.Vector3();
    const tmpColorActive = new THREE.Color(0x67e8f9);
    const tmpColorDone = new THREE.Color(0x34d399);
    const tmpColorError = new THREE.Color(0xf87171);
    const tmpColorIdle = new THREE.Color(0x0284c7);

    let rafId = 0;
    let alive = true;
    let lastTime = performance.now();
    let elapsed = 0;

    // Software WebGL pacing helper per Three.js skill
    const glCtx = renderer.getContext() as WebGL2RenderingContext;
    const afterDraw = (cb: () => void) => {
      if (!isSoftwareGl || typeof glCtx.fenceSync !== 'function') {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const sync = glCtx.fenceSync(glCtx.SYNC_GPU_COMMANDS_COMPLETE, 0);
      if (!sync) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const poll = () => {
        if (!alive) {
          glCtx.deleteSync(sync);
          return;
        }
        const status = glCtx.clientWaitSync(sync, 0, 0);
        if (status === glCtx.WAIT_FAILED || status !== glCtx.TIMEOUT_EXPIRED) {
          glCtx.deleteSync(sync);
          setTimeout(cb, 16);
        } else {
          setTimeout(poll, 10);
        }
      };
      setTimeout(poll, 8);
    };

    const tick = () => {
      if (!alive) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (contextLost) {
        afterDraw(tick);
        return;
      }

      const status = liveStatusRef.current;
      const isBusy = status.busy;
      elapsed += dt * (isBusy ? 1.75 : 1.0);

      // Smooth pointer parallax on rootGroup
      rootGroup.rotation.y = THREE.MathUtils.damp(
        rootGroup.rotation.y,
        pointerX * 0.14 + Math.sin(elapsed * 0.25) * 0.04,
        4,
        dt
      );
      rootGroup.rotation.x = THREE.MathUtils.damp(
        rootGroup.rotation.x,
        -pointerY * 0.09 + Math.cos(elapsed * 0.2) * 0.025,
        4,
        dt
      );

      // Animate core sphere center position slightly left/right depending on activity
      const targetCoreX = viewportW < 640 ? 0.55 : isBusy ? 1.45 : 1.15;
      coreGroup.position.x = THREE.MathUtils.damp(
        coreGroup.position.x,
        targetCoreX,
        3.5,
        dt
      );
      coreGroup.position.y = Math.sin(elapsed * 0.9) * 0.11;

      const targetCoreScale = isBusy ? 1.07 : 1.0;
      const newCoreScale = THREE.MathUtils.damp(
        coreGroup.scale.x,
        targetCoreScale,
        4.5,
        dt
      );
      coreGroup.scale.setScalar(newCoreScale);

      // Continuous rotation & harmonic wave displacement of dotted core shell
      corePoints.rotation.y += dt * (isBusy ? 0.42 : 0.16);
      corePoints.rotation.x = Math.sin(elapsed * 0.45) * 0.12;
      coreWireMesh.rotation.y -= dt * (isBusy ? 0.3 : 0.11);
      coreWireMesh.rotation.z += dt * 0.06;

      const waveAmp = isBusy ? 0.11 : 0.045;
      const posArr = corePosAttr.array as Float32Array;
      for (let i = 0; i < coreDotCount; i++) {
        const bx = coreBaseDirs[i * 3];
        const by = coreBaseDirs[i * 3 + 1];
        const bz = coreBaseDirs[i * 3 + 2];
        const disp =
          coreRadius +
          Math.sin(by * 5.0 + elapsed * 2.4) *
            Math.cos(bx * 4.0 - elapsed * 1.6) *
            waveAmp;
        posArr[i * 3] = bx * disp;
        posArr[i * 3 + 1] = by * disp;
        posArr[i * 3 + 2] = bz * disp;
      }
      corePosAttr.needsUpdate = true;

      // Animate orbital rings & comet particles
      for (const ring of orbitalRings) {
        const angle = elapsed * ring.speed + ring.phase;
        ring.comet.position.set(
          Math.cos(angle) * ring.rx,
          0,
          Math.sin(angle) * ring.rz
        );
        ring.group.rotation.z += dt * 0.18 * Math.sign(ring.speed);
      }

      bgWaveMesh.rotation.y += dt * 0.08;
      bgWaveMesh.rotation.x += dt * 0.05;
      stars.rotation.y += dt * 0.02;

      // Animate Satellites, neural filaments, and projected DOM status badges
      for (let idx = 0; idx < satObjs.length; idx++) {
        const sat = satObjs[idx];
        const nodeInfo = status.nodeStatuses[sat.meta.key];
        const isTargetNode = status.activeNode === sat.meta.key;
        const isWorking = nodeInfo?.state === 'working' || (isBusy && isTargetNode);
        const isDone = nodeInfo?.state === 'done';
        const isError = nodeInfo?.state === 'error';

        const bobX = Math.sin(elapsed * 0.75 + sat.meta.phase) * 0.16;
        const bobY = Math.cos(elapsed * 0.95 + sat.meta.phase) * 0.22;
        const bobZ = Math.sin(elapsed * 0.6 + sat.meta.phase) * 0.14;

        sat.group.position.set(
          sat.meta.basePos[0] + bobX,
          sat.meta.basePos[1] + bobY,
          sat.meta.basePos[2] + bobZ
        );

        sat.wireMesh.rotation.y += dt * (isWorking ? 1.6 : 0.35);
        sat.wireMesh.rotation.x += dt * (isWorking ? 0.9 : 0.2);

        const targetScale = isWorking ? 1.24 : isTargetNode ? 1.12 : 1.0;
        sat.currentScale = THREE.MathUtils.damp(
          sat.currentScale,
          targetScale,
          5.5,
          dt
        );
        sat.group.scale.setScalar(sat.currentScale);

        const desiredColor = isError
          ? tmpColorError
          : isWorking
            ? tmpColorActive
            : isDone
              ? tmpColorDone
              : tmpColorIdle;

        sat.wireMat.color.lerp(desiredColor, Math.min(1, dt * 6));
        sat.wireMat.opacity = THREE.MathUtils.damp(
          sat.wireMat.opacity,
          isWorking ? 0.95 : isDone || isTargetNode ? 0.78 : 0.52,
          5,
          dt
        );
        sat.innerMat.opacity = THREE.MathUtils.damp(
          sat.innerMat.opacity,
          isWorking ? 0.48 : 0.2,
          5,
          dt
        );

        // Update beam line from core center to satellite center
        const bArr = sat.beamPosAttr.array as Float32Array;
        bArr[0] = coreGroup.position.x;
        bArr[1] = coreGroup.position.y;
        bArr[2] = coreGroup.position.z;
        bArr[3] = sat.group.position.x;
        bArr[4] = sat.group.position.y;
        bArr[5] = sat.group.position.z;
        sat.beamPosAttr.needsUpdate = true;

        sat.beamMat.color.lerp(desiredColor, Math.min(1, dt * 6));
        sat.beamMat.opacity = THREE.MathUtils.damp(
          sat.beamMat.opacity,
          isWorking ? 0.85 : isTargetNode ? 0.5 : 0.22,
          5,
          dt
        );

        // Animate data packet traveling from Core -> Satellite (or reverse)
        sat.pulseProgress =
          (sat.pulseProgress + dt * (isWorking ? 1.35 : 0.32)) % 1;
        const pT = sat.pulseProgress;
        sat.pulseMesh.position.set(
          THREE.MathUtils.lerp(coreGroup.position.x, sat.group.position.x, pT),
          THREE.MathUtils.lerp(coreGroup.position.y, sat.group.position.y, pT),
          THREE.MathUtils.lerp(coreGroup.position.z, sat.group.position.z, pT)
        );
        sat.pulseMat.color.copy(desiredColor);
        sat.pulseMat.opacity = isWorking ? 0.95 : 0.45;
        sat.pulseMesh.scale.setScalar(isWorking ? 1.55 : 0.8);

        // Project satellite world coordinates to DOM badge
        const domEl = labelRefs.current[sat.meta.key];
        if (domEl) {
          sat.group.getWorldPosition(tmpWorld);
          tmpWorld.y -= 0.92;
          tmpWorld.project(camera);
          const screenX = (tmpWorld.x * 0.5 + 0.5) * viewportW;
          const screenY = (-tmpWorld.y * 0.5 + 0.5) * viewportH;
          const clampedX = Math.max(84, Math.min(viewportW - 84, screenX));
          const clampedY = Math.max(36, Math.min(viewportH - 36, screenY));
          domEl.style.transform = `translate3d(${clampedX}px, ${clampedY}px, 0) translate(-50%, 0)`;
        }
      }

      // Update cross-filament lines between satellites
      for (const wl of webLines) {
        const a = satObjs[wl.aIdx].group.position;
        const b = satObjs[wl.bIdx].group.position;
        const arr = wl.attr.array as Float32Array;
        arr[0] = a.x;
        arr[1] = a.y;
        arr[2] = a.z;
        arr[3] = b.x;
        arr[4] = b.y;
        arr[5] = b.z;
        wl.attr.needsUpdate = true;
      }

      renderer.render(scene, camera);
      afterDraw(tick);
    };

    afterDraw(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      for (const d of disposables) {
        d.dispose();
      }
      renderer.dispose();
      if (canvas.parentElement === container) {
        container.removeChild(canvas);
      }
    };
  }, []);

  const activeHeadline = liveStatus.headline;
  const activeDetail = liveStatus.detail;

  return (
    <div
      className="relative w-full h-[410px] sm:h-[460px] lg:h-[500px] overflow-hidden select-none"
      style={{
        background:
          'radial-gradient(circle at 62% 48%, #0c2659 0%, #061332 45%, #03091a 100%)',
      }}
    >
      {/* 3D WebGL Mount or Static Fallback */}
      {fallbackImage ? (
        <img
          src="/assets/aistudio/image_c49312b7.png"
          alt="Arix 3D Neural Core"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-90"
        />
      ) : (
        <div ref={containerRef} className="w-full h-full" />
      )}

      {/* Projected 2D Node Status Tags over Canvas (Solid Surface - NO backdrop-blur) */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {SATELLITES.map((sat) => {
          const ns = liveStatus.nodeStatuses[sat.key];
          const isWorking = ns?.state === 'working';
          const isDone = ns?.state === 'done';
          const isError = ns?.state === 'error';
          const isSelected = liveStatus.activeNode === sat.key;

          const borderTone = isError
            ? 'border-red-400/75 text-red-200'
            : isWorking
              ? 'border-cyan-300 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.35)]'
              : isDone || isSelected
                ? 'border-emerald-400/65 text-emerald-100'
                : 'border-sky-500/35 text-slate-200';

          return (
            <button
              key={sat.key}
              ref={(el) => {
                labelRefs.current[sat.key] = el;
              }}
              type="button"
              onClick={() => onSelectSatellite?.(sat.key)}
              style={{
                transform: 'translate3d(-999px, -999px, 0)',
              }}
              className={`pointer-events-auto absolute top-0 left-0 px-2.5 py-1 rounded-md bg-[#051026]/92 border text-left transition-colors cursor-pointer hover:border-cyan-300 ${borderTone}`}
            >
              <div className="text-[11px] font-display font-semibold leading-tight whitespace-nowrap flex items-center gap-1.5">
                <span>{sat.label}</span>
                {isWorking && (
                  <span className="font-mono text-[10px] text-cyan-300">
                    ACTIVE
                  </span>
                )}
              </div>
              <div className="text-[10px] font-mono text-slate-300/90 leading-tight max-w-[165px] truncate">
                {ns?.label || sat.subLabel}
              </div>
            </button>
          );
        })}
      </div>

      {/* Top-Left Live Arix Status Readout (Solid surface, no backdrop-filter) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 z-10 flex flex-wrap items-start justify-between gap-3">
        <div
          className={`pointer-events-auto max-w-md px-3.5 py-2.5 rounded-lg bg-[#051026]/92 border ${
            liveStatus.busy
              ? 'border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.25)]'
              : 'border-slate-700/90'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                liveStatus.busy
                  ? 'bg-cyan-300'
                  : liveStatus.activeNode !== 'core'
                    ? 'bg-emerald-400'
                    : 'bg-sky-400'
              }`}
            />
            <span>{activeHeadline}</span>
          </div>
          <p className="mt-1 text-xs text-slate-300 font-mono truncate">
            {activeDetail}
          </p>
        </div>

        <div className="pointer-events-auto px-3 py-2 rounded-lg bg-[#051026]/92 border border-slate-700/90 text-xs text-slate-300 font-mono tabular-nums whitespace-nowrap">
          {connectedCount} connected · {activeRuleCount} rules
        </div>
      </div>
    </div>
  );
}
