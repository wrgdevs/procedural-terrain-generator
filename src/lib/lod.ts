export type LodLevel = 0 | 1 | 2;

export type LodSettings = {
  nearDistance: number;
  midDistance: number;
};

export function getChunkDistance(
  cameraX: number,
  cameraZ: number,
  chunkX: number,
  chunkZ: number,
  chunkSize: number
) {
  const centerX = chunkX * chunkSize;
  const centerZ = chunkZ * chunkSize;
  return Math.hypot(cameraX - centerX, cameraZ - centerZ);
}

export function getLodLevel(
  distance: number,
  settings: LodSettings
): LodLevel {
  if (distance < settings.nearDistance) return 0;
  if (distance < settings.midDistance) return 1;
  return 2;
}

export function getLodStep(lodLevel: LodLevel) {
  if (lodLevel === 0) return 1;
  if (lodLevel === 1) return 2;
  return 4;
}