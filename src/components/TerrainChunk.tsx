import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { LodLevel } from "../lib/lod";
import { buildChunkGeometry, type TerrainParams } from "../lib/terrain";

type Props = {
  terrain: TerrainParams;
  chunkX: number;
  chunkZ: number;
  lodLevel: LodLevel;
};

const TERRAIN_MATERIAL = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 1,
  metalness: 0,
});

export function TerrainChunk({ terrain, chunkX, chunkZ, lodLevel }: Props) {
  const geometry = useMemo(
    () => buildChunkGeometry(terrain, chunkX, chunkZ, lodLevel),
    [terrain, chunkX, chunkZ, lodLevel]
  );

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <mesh
      geometry={geometry}
      material={TERRAIN_MATERIAL}
      position={[chunkX * terrain.chunkSize, 0, chunkZ * terrain.chunkSize]}
      castShadow
      receiveShadow
    />
  );
}
