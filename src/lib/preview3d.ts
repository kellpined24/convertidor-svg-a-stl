import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { ConversionResult } from './convert';

export class Preview3D {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private group: THREE.Group | null = null;
  private resizeObserver: ResizeObserver;
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    this.camera.position.set(80, -120, 120);
    this.camera.up.set(0, 0, 1);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1.8);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(1, -1, 2);
    this.scene.add(dir);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.animate();
  }

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  showConversion(result: ConversionResult) {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    const group = new THREE.Group();
    for (const part of result.parts) {
      const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.55, metalness: 0.05 });
      const mesh = new THREE.Mesh(part.geometry, material);
      group.add(mesh);
    }
    this.scene.add(group);
    this.group = group;

    const { widthMM, heightMM, thicknessMM } = result.measurements;
    const maxDim = Math.max(widthMM, heightMM, thicknessMM, 1);
    const dist = maxDim * 1.8;
    this.camera.position.set(dist * 0.6, -dist * 0.9, dist * 0.9);
    this.controls.target.set(0, 0, thicknessMM / 2);
    this.camera.near = maxDim / 100;
    this.camera.far = maxDim * 20;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  clear() {
    if (this.group) {
      this.scene.remove(this.group);
      this.group = null;
    }
  }

  dispose() {
    this.resizeObserver.disconnect();
    this.renderer.dispose();
  }
}
