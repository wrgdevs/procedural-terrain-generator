export type ChunkCoord = {
  x: number;
  z: number;
};

export function makeChunkList(center: ChunkCoord, radius: number) {
  const chunks: ChunkCoord[] = [];

  for (let z = center.z - radius; z <= center.z + radius; z++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      chunks.push({ x, z });
    }
  }

  chunks.sort((a, b) => {
    const adx = a.x - center.x;
    const adz = a.z - center.z;
    const bdx = b.x - center.x;
    const bdz = b.z - center.z;
    return adx * adx + adz * adz - (bdx * bdx + bdz * bdz);
  });

  return chunks;
}