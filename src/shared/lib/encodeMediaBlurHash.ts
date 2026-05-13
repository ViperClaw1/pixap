import { encode } from "blurhash";
import { decode } from "jpeg-js";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { bytesFromBase64 } from "@/shared/lib/bytesFromBase64";

/**
 * Builds a BlurHash string from a local image URI (picker / camera).
 * Uses a tiny JPEG decode path — keep calls off the critical UI path (e.g. run during upload).
 */
export async function encodeBlurHashFromPickerAssetUri(assetUri: string): Promise<string | null> {
  try {
    const result = await manipulateAsync(assetUri, [{ resize: { width: 32, height: 32 } }], {
      compress: 0.72,
      format: SaveFormat.JPEG,
      base64: true,
    });
    if (!result.base64) return null;
    const raw = bytesFromBase64(result.base64);
    const decoded = decode(raw, { useTArray: true });
    const { width, height, data } = decoded;
    if (!width || !height || !data.length) return null;
    const pixels = new Uint8ClampedArray(width * height * 3);
    for (let i = 0; i < width * height; i += 1) {
      const o = i * 4;
      const p = i * 3;
      pixels[p] = data[o]!;
      pixels[p + 1] = data[o + 1]!;
      pixels[p + 2] = data[o + 2]!;
    }
    return encode(pixels, width, height, 4, 3);
  } catch {
    return null;
  }
}
