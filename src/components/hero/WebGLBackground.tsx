"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface WebGLBackgroundProps {
  className?: string;
}

export default function WebGLBackground({ className }: WebGLBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    );
    camera.position.z = 7;

    // ---- starfield points ----
    const COUNT = prefersReduced ? 240 : 620;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const green = new THREE.Color("#2bff63");
    const white = new THREE.Color("#dffff2");
    const red = new THREE.Color("#ff3b3b");

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 22;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 12;
      const r = Math.random();
      const c = r < 0.72 ? green : r < 0.9 ? white : red;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointsGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const pointMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(pointsGeo, pointMat);
    scene.add(points);

    // ---- wireframe icosahedron ("portal core") ----
    const coreGeo = new THREE.IcosahedronGeometry(2.4, 1);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x00ff41,
      wireframe: true,
      transparent: true,
      opacity: prefersReduced ? 0.5 : 0.16,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // ---- inner solid wireframe, slightly smaller, rotated ----
    const innerGeo = new THREE.IcosahedronGeometry(1.35, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x7dffa6,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    scene.add(inner);

    // ---- glow sprite behind core ----
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(0,255,65,0.5)");
    gradient.addColorStop(0.4, "rgba(0,255,65,0.12)");
    gradient.addColorStop(1, "rgba(0,255,65,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(canvas);

    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.55,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.scale.set(9, 9, 1);
    scene.add(glow);

    // ---- interaction state ----
    const mouse = { x: 0, y: 0 };
    const getTarget = () => ({
      x: (mouse.x / window.innerWidth) * 2 - 1,
      y: -((mouse.y / window.innerHeight) * 2 - 1),
    });

    const onPointer = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    // ---- pause when offscreen / hidden ----
    let visible = true;
    let pageHidden = false;
    const onVisibility = () => {
      pageHidden = document.hidden;
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    io.observe(container);
    document.addEventListener("visibilitychange", onVisibility);

    // ---- resize ----
    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // ---- animation loop ----
    let rafId = 0;
    const isActive = () => visible && !pageHidden;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (!isActive() && !prefersReduced) {
        // still render a single idle frame occasionally; cheap:
        renderer.render(scene, camera);
        return;
      }

      const t = performance.now() * 0.001;

      core.rotation.x = t * 0.12;
      core.rotation.y = t * 0.19;
      inner.rotation.x = -t * 0.21;
      inner.rotation.z = t * 0.16;

      const pos = pointsGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < COUNT; i++) {
        const i3 = i * 3;
        pos[i3 + 1] += Math.sin(t * 0.35 + i) * 0.0006;
        pos[i3] += Math.cos(t * 0.29 + i) * 0.00055;
      }
      pointsGeo.attributes.position.needsUpdate = true;
      points.rotation.y = t * 0.02;

      const target = getTarget();
      camera.position.x += (target.x * 0.7 - camera.position.x) * 0.04;
      camera.position.y += (target.y * 0.5 - camera.position.y) * 0.04;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    if (!prefersReduced) {
      tick();
      const stop = () => {
        cancelAnimationFrame(rafId);
      };
      window.addEventListener("beforeunload", stop);
    } else {
      renderer.render(scene, camera);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("beforeunload", () => cancelAnimationFrame(rafId));
      document.removeEventListener("visibilitychange", onVisibility);
      io.disconnect();
      pointsGeo.dispose();
      pointMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      glowTex.dispose();
      glowMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className={className} aria-hidden="true" />;
}