declare module "three/examples/jsm/exporters/GLTFExporter" {
  import { Object3D } from "three";

  export interface GLTFExporterOptions {
    binary?: boolean;
    trs?: boolean;
    onlyVisible?: boolean;
    truncateDrawRange?: boolean;
    embedImages?: boolean;
    maxTextureSize?: number;
    forcePowerOfTwoTextures?: boolean;
  }

  export class GLTFExporter {
    parse(
      input: Object3D,
      onCompleted: (gltf: ArrayBuffer | string) => void,
      onError?: (error: unknown) => void,
      options?: GLTFExporterOptions
    ): void;
  }
}