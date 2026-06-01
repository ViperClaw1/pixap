import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import type {
  SpeechRecognitionErrorCode,
  SpeechRecognitionErrorEvent,
  SpeechRecognitionResultEvent,
} from "../model/types";
import { mapSpeechLocale } from "./mapSpeechLocale";
import { getSpeechRecognitionModule } from "./speechRecognitionRuntime";

type TranscriptMeta = { isFinal: boolean };

type Options = {
  onTranscript?: (text: string, meta: TranscriptMeta) => void;
  onListeningChange?: (listening: boolean) => void;
  onError?: (code: SpeechRecognitionErrorCode, message: string) => void;
};

export function useSpeechToText(options: Options = {}) {
  const { i18n, t } = useTranslation();
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [runtimeChecked, setRuntimeChecked] = useState(false);

  const lang = mapSpeechLocale(i18n.language);

  useEffect(() => {
    const module = getSpeechRecognitionModule();
    if (!module) {
      setIsAvailable(false);
      setRuntimeChecked(true);
      return;
    }

    setIsAvailable(module.isRecognitionAvailable());
    setRuntimeChecked(true);

    const onStart = () => {
      setIsListening(true);
      optionsRef.current.onListeningChange?.(true);
    };
    const onEnd = () => {
      setIsListening(false);
      optionsRef.current.onListeningChange?.(false);
    };
    const onResult = (event: SpeechRecognitionResultEvent) => {
      const transcript = event.results[0]?.transcript ?? "";
      optionsRef.current.onTranscript?.(transcript, { isFinal: event.isFinal });
    };
    const onError = (event: SpeechRecognitionErrorEvent) => {
      setIsListening(false);
      optionsRef.current.onListeningChange?.(false);
      if (event.error === "aborted") return;
      optionsRef.current.onError?.(event.error, event.message);
    };

    const startSub = module.addListener("start", onStart);
    const endSub = module.addListener("end", onEnd);
    const resultSub = module.addListener("result", onResult);
    const errorSub = module.addListener("error", onError);

    return () => {
      startSub.remove();
      endSub.remove();
      resultSub.remove();
      errorSub.remove();
      module.abort();
    };
  }, []);

  const stop = useCallback(() => {
    getSpeechRecognitionModule()?.stop();
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    const module = getSpeechRecognitionModule();
    if (!module) {
      Alert.alert(t("speechInput.unavailableTitle"), t("speechInput.unavailableMessage"));
      return false;
    }

    if (!module.isRecognitionAvailable()) {
      Alert.alert(t("speechInput.unavailableTitle"), t("speechInput.unavailableMessage"));
      return false;
    }

    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("speechInput.permissionTitle"), t("speechInput.permissionMessage"));
      return false;
    }

    module.start({
      lang,
      interimResults: true,
      continuous: false,
    });
    return true;
  }, [lang, t]);

  const toggle = useCallback(async () => {
    if (isListening) {
      stop();
      return;
    }
    await start();
  }, [isListening, start, stop]);

  return { isListening, isAvailable, runtimeChecked, start, stop, toggle };
}
