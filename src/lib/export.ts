import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import { makeChunkList, type ChunkCoord } from "./chunks";
import { buildChunkGeometry, buildTerrainSnapshot, type TerrainParams } from "./terrain";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

export async function exportHeightmapPNG(
  terrain: TerrainParams,
  centerChunk: ChunkCoord,
  filename = "heightmap.png"
) {
  const snapshot = buildTerrainSnapshot(terrain, centerChunk.x, centerChunk.z);
  const { heights, stats, resolution } = snapshot;

  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const image = ctx.createImageData(resolution, resolution);
  const range = Math.max(0.0001, stats.maxHeight - stats.minHeight);

  for (let i = 0; i < heights.length; i++) {
    const normalized = (heights[i] - stats.minHeight) / range;
    const value = Math.max(0, Math.min(255, Math.round(normalized * 255)));

    image.data[i * 4 + 0] = value;
    image.data[i * 4 + 1] = value;
    image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = 255;
  }

  ctx.putImageData(image, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );

  if (blob) downloadBlob(blob, filename);
}

export async function exportTerrainGLTF(
  terrain: TerrainParams,
  centerChunk: ChunkCoord,
  visibleRadius: number,
  filename = "terrain.glb"
) {
  const scene = new THREE.Scene();
  const chunks = makeChunkList(centerChunk, visibleRadius);
  const disposable: Array<THREE.Mesh> = [];

  for (const chunk of chunks) {
    const geometry = buildChunkGeometry(terrain, chunk.x, chunk.z, 0);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      metalness: 0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(
      chunk.x * terrain.chunkSize,
      0,
      chunk.z * terrain.chunkSize
    );

    scene.add(mesh);
    disposable.push(mesh);
  }

  const exporter = new GLTFExporter();

  const result = await new Promise<ArrayBuffer | string>((resolve, reject) => {
    exporter.parse(
      scene,
      (value) => resolve(value as ArrayBuffer | string),
      reject,
      {
        binary: true,
        onlyVisible: false,
        truncateDrawRange: true,
      }
    );
  });

  for (const mesh of disposable) {
    mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => m.dispose());
    } else {
      mesh.material.dispose();
    }
  }

  const blob =
    result instanceof ArrayBuffer
      ? new Blob([result], { type: "model/gltf-binary" })
      : new Blob([result], { type: "application/json" });

  downloadBlob(blob, filename);
}