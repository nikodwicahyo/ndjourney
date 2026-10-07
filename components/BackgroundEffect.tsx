"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import * as THREE from "three";

// Per-device tier: density/pixel-budget scale down on smaller screens.
// Motion itself is normalized to the view, so feel is identical everywhere.
const TIERS = [
  { max: 640, hearts: 20, rings: 5, pearls: 6, gems: 5, cubes: 4, particles: 150, dpr: 1.5, antialias: false },
  { max: 1024, hearts: 30, rings: 6, pearls: 8, gems: 6, cubes: 5, particles: 220, dpr: 1.75, antialias: true },
  { max: Infinity, hearts: 40, rings: 8, pearls: 10, gems: 8, cubes: 6, particles: 320, dpr: 2, antialias: true },
] as const;

type FloatUserData = {
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
  speed: number; // normalized units/s — screen-relative, same feel on any device
  ang: number; // drift heading
  dirSpeed: number; // slow heading rotation → curved wander, not ping-pong
  swaySpeedX: number;
  swaySpeedY: number;
  swayAmpX: number;
  swayAmpY: number;
  seed: number;
  baseScale: number;
  nx: number; // normalized position; |n| = 1 is just past the view edge
  ny: number;
  bx: number; // world half-bounds at this mesh's depth (aspect-dependent)
  by: number;
  ox: number; // pointer-repulsion offset (world units, decays)
  oy: number;
};

function createHeartGeometry() {
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0.25, 0.25);
  heartShape.bezierCurveTo(0.25, 0.25, 0.2, 0, 0, 0);
  heartShape.bezierCurveTo(-0.3, 0, -0.3, 0.35, -0.3, 0.35);
  heartShape.bezierCurveTo(-0.3, 0.55, -0.1, 0.77, 0.25, 0.95);
  heartShape.bezierCurveTo(0.6, 0.77, 0.8, 0.55, 0.8, 0.35);
  heartShape.bezierCurveTo(0.8, 0.35, 0.8, 0, 0.5, 0);
  heartShape.bezierCurveTo(0.35, 0, 0.25, 0.25, 0.25, 0.25);

  const geom = new THREE.ExtrudeGeometry(heartShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.08,
  });
  geom.center();
  return geom;
}

// Dark: soft romantic palette. Light: soft cream — visible but gentle so
// text/cards stay readable.
const DARK_HEARTS = [0xf43f5e, 0xfb7185, 0xfecdd3, 0xe11d48, 0xffa5ba];
const LIGHT_HEARTS = [0xfffdf7, 0xfffbeb, 0xfff4e0, 0xfdf2f8, 0xfdf6e3];

// Bounce happens past the visible edge so a shape never pops mid-screen.
const MARGIN = 1.12;

export default function BackgroundEffect() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const applyThemeRef = useRef<(dark: boolean) => void>(null);

  // Scene setup — runs once.
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Product requirement: the background must animate on ALL devices,
    // including ones with OS reduced-motion on — motion stays gentle
    // (slow drift/pulse, subtle parallax) instead of being disabled.
    const tier = TIERS.find((t) => window.innerWidth < t.max) ?? TIERS[TIERS.length - 1];

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.z = 18;

    // Frustum half-extents at the z=0 plane. Spawn, layout, parallax and
    // interaction all derive from these, so the scene reads correctly from
    // phone portrait to ultrawide.
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    let halfW = 0;
    let halfH = 0;
    let minHalf = 0;
    const computeView = () => {
      halfW = tanHalf * camera.position.z * camera.aspect;
      halfH = tanHalf * camera.position.z;
      minHalf = Math.min(halfW, halfH);
    };
    computeView();

    // Graceful degradation: if WebGL context creation fails, bail out and
    // leave the gradient + readability veil (never crash the whole page).
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: tier.antialias });
    } catch {
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, tier.dpr));
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffe4e6, 0.9);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xff6b81, 1.2);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xf43f5e, 1.5, 30);
    pointLight.position.set(-6, -4, 5);
    scene.add(pointLight);

    const heartGeometry = createHeartGeometry();
    const heartMaterials = DARK_HEARTS.map(
      (color) =>
        new THREE.MeshPhongMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.2,
          shininess: 70,
          specular: 0xffffff,
          transparent: true,
          opacity: 0.85,
        }),
    );

    const gemMaterials = [0xfda4af, 0xfcd34d, 0xfbcfe8].map(
      (color) =>
        new THREE.MeshPhongMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.25,
          shininess: 120,
          specular: 0xffffff,
          transparent: true,
          opacity: 0.85,
        }),
    );
    const tintMaterials = [...heartMaterials, ...gemMaterials];
    // Bold gold reserved for cubes — saturated in both modes so it always reads.
    const goldMaterial = new THREE.MeshPhongMaterial({
      color: 0xfcd34d,
      emissive: 0xfcd34d,
      emissiveIntensity: 0.3,
      shininess: 140,
      specular: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const glowMaterials = [...tintMaterials, goldMaterial];
    const ringGeo = new THREE.TorusGeometry(0.45, 0.12, 12, 28);
    const pearlGeo = new THREE.SphereGeometry(0.32, 20, 20);
    const gemGeo = new THREE.OctahedronGeometry(0.42);
    const cubeGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);

    // World half-bounds for a mesh at depth z: the visible frustum there,
    // plus MARGIN so bounces happen off-screen. Recomputed on resize.
    const applyBounds = (u: FloatUserData, z: number) => {
      const depth = Math.max(camera.position.z - z, 1);
      u.bx = tanHalf * depth * camera.aspect * MARGIN;
      u.by = tanHalf * depth * MARGIN;
    };

    // Edge–center–edge spread: uniform across the visible width, with the
    // text-reading center column thinned ~50% instead of emptied.
    const spawnNorm = (thinCenter: boolean) => {
      const n = Math.random() * 2 - 1;
      if (thinCenter && Math.abs(n) < 0.4 && Math.random() < 0.5) {
        return (n < 0 ? -1 : 1) * (0.4 + Math.random() * 0.6);
      }
      return n;
    };

    const floaters: THREE.Mesh[] = [];
    const addFloater = (mesh: THREE.Mesh, scale: number) => {
      const z = (Math.random() - 0.5) * 16 - 2;
      const u: FloatUserData = {
        rotSpeedX: (Math.random() - 0.5) * 1.1,
        rotSpeedY: (Math.random() - 0.5) * 1.3,
        rotSpeedZ: (Math.random() - 0.5) * 0.7,
        speed: 0.035 + Math.random() * 0.07, // ~20–60s crossing the view
        ang: Math.random() * Math.PI * 2,
        dirSpeed: (Math.random() - 0.5) * 0.12,
        swaySpeedX: 0.4 + Math.random() * 1.6,
        swaySpeedY: 0.4 + Math.random() * 1.6,
        swayAmpX: 0.025 + Math.random() * 0.045,
        swayAmpY: 0.02 + Math.random() * 0.04,
        seed: Math.random() * 100,
        baseScale: scale,
        nx: spawnNorm(true),
        ny: spawnNorm(false),
        bx: 0,
        by: 0,
        ox: 0,
        oy: 0,
      };
      applyBounds(u, z);
      mesh.scale.set(scale, scale, scale);
      mesh.position.set(u.nx * u.bx, u.ny * u.by, z);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      mesh.userData = u;
      scene.add(mesh);
      floaters.push(mesh);
    };

    for (let i = 0; i < tier.hearts; i++) {
      addFloater(
        new THREE.Mesh(heartGeometry, heartMaterials[i % heartMaterials.length]),
        0.5 + Math.random() * 1.4,
      );
    }
    for (let i = 0; i < tier.rings; i++) {
      addFloater(
        new THREE.Mesh(ringGeo, gemMaterials[i % gemMaterials.length]),
        0.6 + Math.random() * 0.9,
      );
    }
    for (let i = 0; i < tier.pearls; i++) {
      addFloater(
        new THREE.Mesh(pearlGeo, gemMaterials[(i + 1) % gemMaterials.length]),
        0.7 + Math.random() * 1.1,
      );
    }
    for (let i = 0; i < tier.gems; i++) {
      addFloater(
        new THREE.Mesh(gemGeo, gemMaterials[(i + 2) % gemMaterials.length]),
        0.8 + Math.random() * 1.2,
      );
    }
    for (let i = 0; i < tier.cubes; i++) {
      addFloater(new THREE.Mesh(cubeGeo, goldMaterial), 0.9 + Math.random() * 1.2);
    }

    const particleCount = tier.particles;
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const pnx = new Float32Array(particleCount);
    const pny = new Float32Array(particleCount);
    const pz = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      pnx[i] = Math.random() * 2 - 1;
      pny[i] = Math.random() * 2 - 1;
      pz[i] = (Math.random() - 0.5) * 20;
    }
    const posAttr = new THREE.BufferAttribute(positions, 3);
    particleGeometry.setAttribute("position", posAttr);
    // Dust field tracks the frustum (±30% bleed past the edges); refit on
    // resize keeps it evenly spread on every aspect ratio.
    const layoutParticles = () => {
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = pnx[i] * halfW * 1.3;
        positions[i * 3 + 1] = pny[i] * halfH * 1.4;
        positions[i * 3 + 2] = pz[i];
      }
      posAttr.needsUpdate = true;
    };
    layoutParticles();
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xffccd5,
      size: 0.25,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Mutable theme state read by the animation loop (twinkle/glow bases).
    const themeState = {
      particleBase: 0.65,
      pointBase: 1.5,
      glowAmp: 0.3,
      emissiveBase: 0.2,
      emissiveAmp: 0.14,
    };

    const applyTheme = (dark: boolean) => {
      const palette = dark ? DARK_HEARTS : LIGHT_HEARTS;
      tintMaterials.forEach((m, i) => {
        m.color.set(palette[i % palette.length]);
        m.emissive.set(palette[i % palette.length]);
        m.opacity = dark ? 0.85 : 0.7;
      });
      // Gems/cubes read smaller on screen — keep them a touch more solid.
      for (const m of gemMaterials) m.opacity = dark ? 0.9 : 0.85;
      // Gold cubes stay bold: bright gold on dark, deep amber on light cream.
      const gold = dark ? 0xfcd34d : 0xd97706;
      goldMaterial.color.set(gold);
      goldMaterial.emissive.set(gold);
      goldMaterial.opacity = dark ? 0.95 : 0.9;
      themeState.particleBase = dark ? 0.65 : 0.35;
      themeState.pointBase = dark ? 1.5 : 0.8;
      themeState.glowAmp = dark ? 0.3 : 0.15;
      themeState.emissiveBase = dark ? 0.2 : 0.12;
      themeState.emissiveAmp = dark ? 0.14 : 0.08;
      particleMaterial.opacity = themeState.particleBase;
      particleMaterial.color.set(dark ? 0xffccd5 : 0xfde68a);
      const nextBlending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
      if (particleMaterial.blending !== nextBlending) {
        particleMaterial.blending = nextBlending;
        particleMaterial.needsUpdate = true;
      }
      ambient.intensity = dark ? 0.9 : 1.0;
      dirLight.intensity = dark ? 1.2 : 1.1;
    };
    applyThemeRef.current = applyTheme;
    applyTheme(document.documentElement.classList.contains("dark"));

    // Pointer in NDC (-1..1 on each axis) — mapped to world units per frame
    // so parallax and repulsion scale with the viewport.
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;
    let lastActive = -10;
    let scrollTarget = 0;
    let scrollSm = 0;
    const setPointer = (clientX: number, clientY: number) => {
      mouseX = (clientX / window.innerWidth - 0.5) * 2;
      mouseY = (clientY / window.innerHeight - 0.5) * 2;
      lastActive = performance.now() / 1000;
    };
    const onMouseMove = (e: MouseEvent) => setPointer(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) setPointer(t.clientX, t.clientY);
    };
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });

    const onScroll = () => {
      const s = window.scrollY * 0.0015;
      scrollTarget = Math.max(-2.5, Math.min(2.5, s));
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Refit on resize/rotation/URL-bar changes — skip no-op events so mobile
    // scrolling doesn't reallocate the GL buffers.
    let lastW = width;
    let lastH = height;
    let lastDpr = renderer.getPixelRatio();
    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, tier.dpr);
      if (w === lastW && h === lastH && dpr === lastDpr) return;
      lastW = w;
      lastH = h;
      lastDpr = dpr;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h);
      computeView();
      // Positions are normalized, so they refit by themselves; only the
      // world bounds need updating (covers phone rotation and resizes).
      for (const f of floaters) {
        applyBounds(f.userData as FloatUserData, f.position.z);
      }
      layoutParticles();
    };
    window.addEventListener("resize", onResize);

    const timer = new THREE.Timer();
    let raf = 0;

    const renderFrame = () => {
      timer.update();
      // Delta-based motion: same speed at 30/60/120fps and on weak GPUs.
      const delta = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      const ease = 1 - Math.exp(-3.5 * delta);
      // Parallax pans a fixed fraction of the view — same feel on any screen.
      targetX += (mouseX * halfW * 0.19 - targetX) * ease;
      targetY += (-mouseY * halfH * 0.24 - targetY) * ease;
      scrollSm += (scrollTarget - scrollSm) * ease;
      camera.position.x = targetX;
      camera.position.y = targetY + scrollSm;
      camera.lookAt(0, 0, 0);

      // Gentle whole-scene sway so depth is visible even without input.
      scene.rotation.y = Math.sin(elapsed * 0.05) * 0.06;
      scene.rotation.x = Math.cos(elapsed * 0.04) * 0.03;

      // Pointer in world units at the z=0 plane — nearby shapes playfully
      // drift away from it (only within 3s of pointer activity, then they
      // settle back). Radius/strength scale with the view size.
      const ptrX = mouseX * halfW;
      const ptrY = -mouseY * halfH;
      const interacting = performance.now() / 1000 - lastActive < 3;
      const decay = Math.exp(-2 * delta);
      const repelR = minHalf * 0.55;
      const pushK = minHalf * 0.6;

      for (const h of floaters) {
        const u = h.userData as FloatUserData;
        h.rotation.x += u.rotSpeedX * delta;
        h.rotation.y += u.rotSpeedY * delta;
        h.rotation.z += u.rotSpeedZ * delta;

        // Wander: heading rotates slowly, so each shape traces a curved
        // path that crosses edge → center → edge and bounces off-screen.
        u.ang += u.dirSpeed * delta;
        u.nx += Math.cos(u.ang) * u.speed * delta;
        u.ny += Math.sin(u.ang) * u.speed * delta;
        if (u.nx > 1 || u.nx < -1) {
          u.nx = u.nx > 0 ? 1 : -1;
          u.ang = Math.PI - u.ang;
        }
        if (u.ny > 1 || u.ny < -1) {
          u.ny = u.ny > 0 ? 1 : -1;
          u.ang = -u.ang;
        }

        if (interacting) {
          const dx = h.position.x - ptrX;
          const dy = h.position.y - ptrY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < repelR && dist > 0.001) {
            const push = ((repelR - dist) / repelR) * delta * pushK;
            u.ox += (dx / dist) * push;
            u.oy += (dy / dist) * push;
          }
        }
        u.ox *= decay;
        u.oy *= decay;

        const wx = (u.nx + Math.sin(elapsed * u.swaySpeedX + u.seed) * u.swayAmpX) * u.bx;
        const wy = (u.ny + Math.sin(elapsed * u.swaySpeedY + u.seed * 1.7) * u.swayAmpY) * u.by;
        h.position.x = wx + u.ox;
        h.position.y = wy + u.oy;
        // Heartbeat pulse — the most visible "alive" cue.
        const pulse = 1 + 0.1 * Math.sin(elapsed * 2 + u.seed);
        h.scale.set(u.baseScale * pulse, u.baseScale * pulse, u.baseScale);
      }

      // Shimmer: emissive glow waves, orbiting light, twinkle + size breathing.
      for (let i = 0; i < glowMaterials.length; i++) {
        glowMaterials[i].emissiveIntensity =
          themeState.emissiveBase + themeState.emissiveAmp * Math.sin(elapsed * 1.8 + i * 1.3);
      }
      pointLight.intensity = themeState.pointBase + Math.sin(elapsed * 2.3) * themeState.glowAmp;
      pointLight.position.x = -6 + Math.sin(elapsed * 0.4) * 3;
      pointLight.position.y = -4 + Math.cos(elapsed * 0.3) * 2;
      particleMaterial.opacity = themeState.particleBase + Math.sin(elapsed * 1.5) * 0.12;
      particleMaterial.size = 0.25 + Math.sin(elapsed * 2) * 0.04;
      particles.rotation.y = elapsed * 0.02;
      particles.rotation.x = elapsed * 0.01;

      renderer.render(scene, camera);
    };

    const loop = () => {
      renderFrame();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      applyThemeRef.current = null;
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh || (obj as THREE.Points).isPoints) {
          const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat?.dispose();
          (mesh.geometry as THREE.BufferGeometry)?.dispose();
        }
      });
      heartGeometry.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Theme updates without rebuilding the scene.
  useEffect(() => {
    if (resolvedTheme) applyThemeRef.current?.(resolvedTheme === "dark");
  }, [resolvedTheme]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: -10 }}
    >
      <div ref={mountRef} className="absolute inset-0" />
      {/* Rose vignette: rich edges, calm center for text */}
      <div className="absolute inset-0" style={{ background: "var(--bg-vignette)" }} />
      {/* Readability veil: keeps cards/text contrast in both modes */}
      <div className="absolute inset-0 bg-rose-50/35 dark:bg-black/50" />
    </div>
  );
}
