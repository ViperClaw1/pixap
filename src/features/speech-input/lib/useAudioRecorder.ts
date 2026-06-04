import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder as useExpoAudioRecorder,
} from "expo-audio";
import { transcribeAudioFile } from "../api/transcribeAudioFile";
import { mapSpeechLocale } from "./mapSpeechLocale";

export type AudioRecorderErrorCode =
  | "permission-denied"
  | "recording-failed"
  | "recording-too-short"
  | "upload-failed"
  | "transcription-failed";

export type AudioRecorderState =
  | { status: "idle" }
  | { status: "recording"; startedAt: number }
  | { status: "transcribing" }
  | { status: "error"; message: string };

type TranscriptMeta = { isFinal: boolean };

type Options = {
  onTranscript?: (text: string, meta: TranscriptMeta) => void;
  onListeningChange?: (listening: boolean) => void;
  onError?: (code: AudioRecorderErrorCode, message: string) => void;
  maxDurationMs?: number;
  minDurationMs?: number;
};

const DEFAULT_MAX_DURATION_MS = 30_000;
const DEFAULT_MIN_DURATION_MS = 450;

function isNetworkUploadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("network") || message.includes("fetch");
}

export function useAudioRecorder(options: Options = {}) {
  const { i18n, t } = useTranslation();
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, setState] = useState<AudioRecorderState>({ status: "idle" });
  const stateRef = useRef<AudioRecorderState>({ status: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);

  const lang = mapSpeechLocale(i18n.language);
  const maxDurationMs = options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS;
  const minDurationMs = options.minDurationMs ?? DEFAULT_MIN_DURATION_MS;

  const setRecorderState = useCallback((nextState: AudioRecorderState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const finishSession = useCallback(() => {
    stoppingRef.current = false;
    optionsRef.current.onListeningChange?.(false);
  }, []);

  const stopAndTranscribe = useCallback(async () => {
    if (stoppingRef.current) return;
    if (stateRef.current.status !== "recording") return;

    stoppingRef.current = true;
    clearTimer();

    const startedAt = stateRef.current.startedAt;
    try {
      await recorder.stop();
      const durationMs = Date.now() - startedAt;
      if (durationMs < minDurationMs) {
        setRecorderState({ status: "idle" });
        finishSession();
        optionsRef.current.onError?.("recording-too-short", t("speechInput.recordingTooShort"));
        return;
      }

      const uri = recorder.uri;
      if (!uri) {
        setRecorderState({ status: "idle" });
        finishSession();
        optionsRef.current.onError?.("recording-failed", t("speechInput.errorGeneric"));
        return;
      }

      setRecorderState({ status: "transcribing" });
      const text = await transcribeAudioFile(uri, lang);
      setRecorderState({ status: "idle" });
      optionsRef.current.onTranscript?.(text, { isFinal: true });
      finishSession();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("speechInput.errorGeneric");
      setRecorderState({ status: "error", message });
      const code = isNetworkUploadError(error) ? "upload-failed" : "transcription-failed";
      optionsRef.current.onError?.(code, message);
      finishSession();
    }
  }, [clearTimer, finishSession, lang, minDurationMs, recorder, setRecorderState, t]);

  const stop = useCallback(() => {
    void stopAndTranscribe();
  }, [stopAndTranscribe]);

  const start = useCallback(async (): Promise<boolean> => {
    if (stateRef.current.status === "recording" || stateRef.current.status === "transcribing") {
      return false;
    }

    const permission = await AudioModule.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      optionsRef.current.onError?.("permission-denied", t("speechInput.permissionMessage"));
      return false;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();

      setRecorderState({ status: "recording", startedAt: Date.now() });
      optionsRef.current.onListeningChange?.(true);
      timerRef.current = setTimeout(() => {
        void stopAndTranscribe();
      }, maxDurationMs);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("speechInput.errorGeneric");
      setRecorderState({ status: "error", message });
      finishSession();
      optionsRef.current.onError?.("recording-failed", message);
      return false;
    }
  }, [finishSession, maxDurationMs, recorder, setRecorderState, stopAndTranscribe, t]);

  const toggle = useCallback(async () => {
    if (stateRef.current.status === "recording") {
      stop();
      return;
    }
    if (stateRef.current.status === "idle" || stateRef.current.status === "error") {
      await start();
    }
  }, [start, stop]);

  useEffect(() => {
    return () => {
      clearTimer();
      if (stateRef.current.status === "recording") {
        void recorder.stop().catch(() => undefined);
      }
      finishSession();
    };
  }, [clearTimer, finishSession, recorder]);

  const isListening = state.status === "recording" || state.status === "transcribing";

  return {
    state,
    isRecording: state.status === "recording",
    isTranscribing: state.status === "transcribing",
    isListening,
    isActive: isListening,
    isAvailable: true,
    runtimeChecked: true,
    start,
    stop,
    toggle,
  };
}
