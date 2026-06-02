import { Canvas } from "@react-three/fiber";
import { FlyControls } from "@react-three/drei";
import type { ChunkCoord } from "../lib/chunks";
import type { TerrainParams } from "../lib/terrain";
import { SceneEnvironment } from "./SceneEnvironment";
import { TerrainWorld } from "./TerrainWorld";

type Props = {
  terrain: TerrainParams;
  onCenterChunkChange?: (chunk: ChunkCoord) => void;
};

export function Scene({ terrain, onCenterChunkChange }: Props) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [0, 80, 200], fov: 50, near: 0.1, far: 4000 }}
    >
      <color attach="background" args={["#c8e6ff"]} />
      <fog attach="fog" args={["#c8e6ff", 200, 900]} />

      <SceneEnvironment />

      <ambientLight intensity={0.8} />
      <hemisphereLight intensity={0.45} color="#dff3ff" groundColor="#4c6b3c" />
      <directionalLight
        castShadow
        position={[160, 220, 120]}
        intensity={2.8}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-260}
        shadow-camera-right={260}
        shadow-camera-top={260}
        shadow-camera-bottom={-260}
        shadow-camera-near={0.5}
        shadow-camera-far={700}
      />

      <TerrainWorld terrain={terrain} onCenterChunkChange={onCenterChunkChange} />

      <FlyControls
        movementSpeed={terrain.movementSpeed}
        rollSpeed={0.35}
        dragToLook
      />
    </Canvas>
  );
}