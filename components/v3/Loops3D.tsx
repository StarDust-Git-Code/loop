"use client";

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

/** What a section can drive from GSAP once the scene is ready. */
export interface LoopsApi {
  camera: THREE_NS.PerspectiveCamera;
  /** Scroll-controlled orientation of the whole model. */
  tilt: THREE_NS.Group;
  /** 0..1, how much the idle wobble and pointer follow apply. */
  state: { wobble: number; follow: number };
}

/**
 * The Loopmates logo as a real 3D model: two linked rings, one violet glass-like,
 * one chrome. Renders only while on screen.
 */
export default function Loops3D({
  className,
  onReady,
  follow = true,
  tilt = [0.42, -0.62, 0.18],
  distance = 7,
}: {
  className?: string;
  onReady?: (api: LoopsApi) => void;
  follow?: boolean;
  tilt?: [number, number, number];
  distance?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);
  useEffect(() => { readyRef.current = onReady; });

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let disposed = false;
    let cleanup = () => {};

    (async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;

      const small = window.matchMedia("(max-width: 767px)").matches;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        host.classList.add("no-webgl");
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
      camera.position.set(0, 0, distance);

      const R = 1;
      const geo = new THREE.TorusGeometry(R, 0.3, small ? 64 : 112, small ? 160 : 260);
      const violet = new THREE.MeshPhysicalMaterial({
        color: 0x6a4df4,
        metalness: 0.25,
        roughness: 0.16,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        iridescence: 0.75,
        iridescenceIOR: 1.35,
        sheen: 0.6,
        sheenColor: new THREE.Color(0xc9bcff),
      });
      const chrome = new THREE.MeshPhysicalMaterial({
        color: 0xf1eefc,
        metalness: 1,
        roughness: 0.13,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
      });
      const ringA = new THREE.Mesh(geo, violet);
      ringA.position.x = -R / 2;
      const ringB = new THREE.Mesh(geo, chrome);
      ringB.position.x = R / 2;
      ringB.rotation.x = Math.PI / 2;

      const spin = new THREE.Group();
      spin.add(ringA, ringB);
      const tiltG = new THREE.Group();
      tiltG.rotation.set(tilt[0], tilt[1], tilt[2]);
      tiltG.add(spin);
      const pointerG = new THREE.Group();
      pointerG.add(tiltG);
      scene.add(pointerG);

      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(3, 4, 5);
      const rim = new THREE.PointLight(0x7c5cff, 40, 30);
      rim.position.set(-3.5, -2, 2.5);
      const warm = new THREE.PointLight(0xffd27a, 18, 30);
      warm.position.set(3.5, -2.5, -1.5);
      scene.add(key, rim, warm);

      const state = { wobble: reduced ? 0 : 1, follow: follow && !reduced ? 1 : 0 };
      const pointer = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        pointer.x = e.clientX / window.innerWidth - 0.5;
        pointer.y = e.clientY / window.innerHeight - 0.5;
      };
      if (follow) window.addEventListener("pointermove", onPointer, { passive: true });

      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);
      resize();

      let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: "100px" });
      io.observe(host);

      const clock = new THREE.Clock();
      let raf = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        if (!visible) return;
        const t = clock.getElapsedTime();
        spin.rotation.y = Math.sin(t * 0.35) * 0.55 * state.wobble;
        spin.rotation.x = Math.sin(t * 0.27) * 0.18 * state.wobble;
        spin.rotation.z = Math.sin(t * 0.21) * 0.1 * state.wobble;
        pointerG.rotation.y += (pointer.x * 0.5 * state.follow - pointerG.rotation.y) * 0.05;
        pointerG.rotation.x += (pointer.y * 0.35 * state.follow - pointerG.rotation.x) * 0.05;
        renderer.render(scene, camera);
      };
      tick();
      host.classList.add("gl-ready");

      readyRef.current?.({ camera, tilt: tiltG, state });

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        io.disconnect();
        window.removeEventListener("pointermove", onPointer);
        geo.dispose();
        violet.dispose();
        chrome.dispose();
        envTex.dispose();
        pmrem.dispose();
        renderer.dispose();
      };
    })();

    return () => {
      disposed = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`gl ${className ?? ""}`} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
