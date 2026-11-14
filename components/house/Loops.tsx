"use client";

import { useEffect, useRef } from "react";
import type * as THREE_NS from "three";

/** Written by the scroll timeline, read every frame. fly: 0 = resting in the sky, 1 = flown through. */
export interface LoopsDrive {
  fly: number;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const span = (a: number, b: number, t: number) => clamp01((t - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const TILT: [number, number, number] = [0.42, -0.62, 0.18];
const DIST = 9;
const FOV = 32;

/**
 * The Loopmates mark as a real 3D object: two linked rings, violet glass and chrome.
 * Scroll flies the camera through the violet ring; it stops drawing once it has passed.
 */
export default function Loops({ drive }: { drive: LoopsDrive }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      let renderer: THREE_NS.WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      } catch {
        host.classList.add("no-webgl");
        return;
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);
      camera.position.set(0, 0, DIST);

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
        color: 0xf6efe0,
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
      tiltG.add(spin);
      const pointerG = new THREE.Group();
      pointerG.add(tiltG);
      scene.add(pointerG);

      // moonlight from the top right, lamp-warm from below, violet rim
      const key = new THREE.DirectionalLight(0xfff2dc, 2.4);
      key.position.set(4, 4, 5);
      const rim = new THREE.PointLight(0x7c5cff, 40, 30);
      rim.position.set(-3.5, -2, 2.5);
      const warm = new THREE.PointLight(0xffc870, 22, 30);
      warm.position.set(3, -3, -1.5);
      scene.add(key, rim, warm);

      const pointer = { x: 0, y: 0 };
      const onPointer = (e: PointerEvent) => {
        pointer.x = e.clientX / window.innerWidth - 0.5;
        pointer.y = e.clientY / window.innerHeight - 0.5;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      // The canvas overhangs its frame (.loops) so the rings are never cut off at its edge while the frame is
      // scaled down mid-flight. Widen the lens by the same amount, so the rings keep the size they were framed at.
      const frame = host.parentElement ?? host;
      const resize = () => {
        const w = host.clientWidth || 1;
        const h = host.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        const k = h / (frame.clientHeight || h);
        camera.fov = (360 / Math.PI) * Math.atan(k * Math.tan((FOV * Math.PI) / 360));
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(host);
      resize();

      const clock = new THREE.Clock();
      let raf = 0;
      let drawn = false;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const f = drive.fly;
        // once the camera is through, nothing to draw until the reader scrolls back
        if (f >= 0.995 || document.hidden) {
          if (drawn) {
            renderer.clear();
            drawn = false;
          }
          return;
        }
        const t = clock.getElapsedTime();
        const calm = 1 - span(0, 0.3, f);
        const k1 = smooth(span(0, 0.45, f));
        tiltG.rotation.set(lerp(TILT[0], 0, k1), lerp(TILT[1], 0, k1), lerp(TILT[2], 0, k1));
        spin.rotation.y = Math.sin(t * 0.35) * 0.55 * calm;
        spin.rotation.x = Math.sin(t * 0.27) * 0.18 * calm;
        spin.rotation.z = Math.sin(t * 0.21) * 0.1 * calm;
        pointerG.rotation.y += (pointer.x * 0.5 * calm - pointerG.rotation.y) * 0.05;
        pointerG.rotation.x += (pointer.y * 0.35 * calm - pointerG.rotation.x) * 0.05;

        // line up with the upper half of the violet ring's hole, then fly through it
        const k2 = smooth(span(0.05, 0.5, f));
        camera.position.x = lerp(0, -0.5, k2);
        camera.position.y = lerp(0, 0.48, k2);
        const k3 = span(0.25, 0.8, f);
        camera.position.z = f < 0.8 ? lerp(DIST, 0.6, k3 * k3) : lerp(0.6, -2.5, span(0.8, 1, f));

        renderer.render(scene, camera);
        drawn = true;
      };
      tick();
      host.classList.add("gl-ready");

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
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
  }, [drive]);

  return <canvas ref={canvasRef} />;
}
