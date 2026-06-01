export type {
  SpeechRecognitionErrorCode,
  SpeechRecognitionModule,
  SpeechRecognitionResultEvent,
} from "./model/types";
export { getSpeechRecognitionModule, isSpeechRecognitionRuntimeReady } from "./lib/speechRecognitionRuntime";
export { mapSpeechLocale } from "./lib/mapSpeechLocale";
export { mergeSpeechTranscript } from "./lib/mergeSpeechTranscript";
export { useSpeechToText } from "./lib/useSpeechToText";
export { useComposerVoiceInput } from "./lib/useComposerVoiceInput";
export { VoiceInputButton } from "./ui/VoiceInputButton";
