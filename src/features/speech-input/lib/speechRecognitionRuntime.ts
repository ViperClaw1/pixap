import { requireOptionalNativeModule } from "expo";
import type { SpeechRecognitionModule } from "../model/types";

const MODULE_NAME = "ExpoSpeechRecognition";

let cachedModule: SpeechRecognitionModule | null | undefined;

/**
 * Resolves the native module without loading expo-speech-recognition JS entry
 * (which throws via requireNativeModule when the dev client was not rebuilt).
 */
export function getSpeechRecognitionModule(): SpeechRecognitionModule | null {
  if (cachedModule !== undefined) return cachedModule;
  cachedModule = requireOptionalNativeModule<SpeechRecognitionModule>(MODULE_NAME);
  return cachedModule;
}

export function isSpeechRecognitionRuntimeReady(): boolean {
  return getSpeechRecognitionModule() != null;
}
