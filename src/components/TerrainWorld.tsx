import { useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChunkDistance, getLodLevel } from "../lib/lod";
import { makeChunkList, type ChunkCoord } from "../lib/chunks";
import { TerrainChunk } from "./TerrainChunk";
import type { TerrainParams } from "../lib/terrain";

type Props = {
  terrain: TerrainParams;
  onCenterChunkChange?: (chunk: ChunkCoord) => void;
};

type CameraSample = {
  x: number;
  z: number;
  centerChunk: ChunkCoord;
};

function getCenterChunk(x: number, z: number, chunkSize: number): ChunkCoord {
  return {
    x: Math.round(x / chunkSize),
    z: Math.round(z / chunkSize),
  };
}

function sameChunk(a: ChunkCoord, b: ChunkCoord) {
  return a.x === b.x && a.z === b.z;
}

function WaterPlane({
  terrain,
  centerChunk,
}: {
  terrain: TerrainParams;
  centerChunk: ChunkCoord;
}) {
  const size = terrain.chunkSize * (terrain.visibleRadius * 2 + 6);
  const x = centerChunk.x * terrain.chunkSize;
  const z = centerChunk.z * terrain.chunkSize;

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[x, terrain.waterLevel, z]}
      receiveShadow
    >
      <planeGeometry args={[size, size, 1, 1]} />
      <meshPhysicalMaterial
        color="#4b98ff"
        transparent
        opacity={0.22}
        roughness={0.14}
        metalness={0}
        clearcoat={0.35}
        clearcoatRoughness={0.35}
      />
    </mesh>
  );
}

export function TerrainWorld({ terrain, onCenterChunkChange }: Props) {
  const initialSample = useMemo<CameraSample>(() => {
    const centerChunk = getCenterChunk(0, 0, terrain.chunkSize);
    return { x: 0, z: 0, centerChunk };
  }, [terrain.chunkSize]);

  const [cameraSample, setCameraSample] = useState<CameraSample>(initialSample);
  const cameraSampleRef = useRef<CameraSample>(initialSample);


  useFrame(({ camera }) => {
    const nextCenterChunk = getCenterChunk(
      camera.position.x,
      camera.position.z,
      terrain.chunkSize
    );
    const current = cameraSampleRef.current;

    const movedEnoughForLod =
      Math.hypot(camera.position.x - current.x, camera.position.z - current.z) >=
      Math.max(terrain.chunkSize * 0.15, 4);

    if (!sameChunk(nextCenterChunk, current.centerChunk) || movedEnoughForLod) {
      const next = {
        x: camera.position.x,
        z: camera.position.z,
        centerChunk: nextCenterChunk,
      };

      cameraSampleRef.current = next;
      setCameraSample(next);
    }
  });

  useEffect(() => {
    onCenterChunkChange?.(cameraSample.centerChunk);
  }, [cameraSample.centerChunk, onCenterChunkChange]);

  const visibleChunks = useMemo(
    () => makeChunkList(cameraSample.centerChunk, terrain.visibleRadius),
    [cameraSample.centerChunk, terrain.visibleRadius]
  );

  const getChunkLod = useCallback(
    (chunk: ChunkCoord) => {
      const distance = getChunkDistance(
        cameraSample.x,
        cameraSample.z,
        chunk.x,
        chunk.z,
        terrain.chunkSize
      );

      return getLodLevel(distance, {
        nearDistance: terrain.lodNearDistance,
        midDistance: terrain.lodMidDistance,
      });
    },
    [cameraSample.x, cameraSample.z, terrain.chunkSize, terrain.lodNearDistance, terrain.lodMidDistance]
  );

  return (
    <>
      {visibleChunks.map((chunk) => (
        <TerrainChunk
          key={`${chunk.x}:${chunk.z}`}
          terrain={terrain}
          chunkX={chunk.x}
          chunkZ={chunk.z}
          lodLevel={getChunkLod(chunk)}
        />
      ))}

      <WaterPlane terrain={terrain} centerChunk={cameraSample.centerChunk} />
    </>
  );
}
