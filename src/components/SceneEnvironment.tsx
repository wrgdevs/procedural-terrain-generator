import { Sky, Stars } from "@react-three/drei";

export function SceneEnvironment() {
  return (
    <>
      <Sky
        distance={450000}
        sunPosition={[120, 80, -20]}
        inclination={0.49}
        azimuth={0.28}
        mieCoefficient={0.004}
        mieDirectionalG={0.78}
        turbidity={8}
        rayleigh={2.4}
      />

      <Stars
        radius={300}
        depth={80}
        count={3000}
        factor={4}
        fade
        speed={0.2}
      />

      <mesh position={[120, 80, -20]} renderOrder={1}>
        <sphereGeometry args={[6, 32, 32]} />
        <meshBasicMaterial color="#fff1c4" toneMapped={false} />
      </mesh>
    </>
  );
}