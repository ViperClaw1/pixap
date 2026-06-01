import { useCallback, useRef } from "react";
import { mergeSpeechTranscript } from "./mergeSpeechTranscript";

type TranscriptMeta = { isFinal: boolean };

export function useComposerVoiceInput(text: string, setText: (value: string) => void) {
  const textRef = useRef(text);
  textRef.current = text;

  const baseTextRef = useRef("");
  const isListeningRef = useRef(false);

  const handleListeningChange = useCallback((listening: boolean) => {
    isListeningRef.current = listening;
    if (listening) {
      baseTextRef.current = textRef.current;
    }
  }, []);

  const handleTranscriptChange = useCallback(
    (transcript: string, meta: TranscriptMeta) => {
      const merged = mergeSpeechTranscript(baseTextRef.current, transcript);
      setText(merged);
      if (meta.isFinal) {
        baseTextRef.current = merged;
      }
    },
    [setText],
  );

  const bindStopOnManualEdit = useCallback((stop: () => void) => {
    if (!isListeningRef.current) return;
    stop();
  }, []);

  return {
    handleListeningChange,
    handleTranscriptChange,
    bindStopOnManualEdit,
  };
}
