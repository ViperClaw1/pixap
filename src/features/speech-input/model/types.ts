export type SpeechRecognitionErrorCode =
  | "aborted"
  | "audio-capture"
  | "interrupted"
  | "bad-grammar"
  | "language-not-supported"
  | "network"
  | "no-speech"
  | "not-allowed"
  | "service-not-allowed"
  | "busy"
  | "client"
  | "speech-timeout"
  | "unknown";

export type SpeechRecognitionResult = {
  transcript: string;
  confidence: number;
};

export type SpeechRecognitionResultEvent = {
  isFinal: boolean;
  results: SpeechRecognitionResult[];
};

export type SpeechRecognitionErrorEvent = {
  error: SpeechRecognitionErrorCode;
  message: string;
};

export type SpeechRecognitionPermissionResponse = {
  granted: boolean;
  canAskAgain?: boolean;
};

export type SpeechRecognitionStartOptions = {
  lang: string;
  interimResults?: boolean;
  continuous?: boolean;
};

export type SpeechRecognitionModule = {
  isRecognitionAvailable(): boolean;
  requestPermissionsAsync(): Promise<SpeechRecognitionPermissionResponse>;
  start(options: SpeechRecognitionStartOptions): void;
  stop(): void;
  abort(): void;
  addListener<Event extends keyof SpeechRecognitionNativeEventMap>(
    eventName: Event,
    listener: (event: SpeechRecognitionNativeEventMap[Event]) => void,
  ): { remove(): void };
};

export type SpeechRecognitionNativeEventMap = {
  start: null;
  end: null;
  result: SpeechRecognitionResultEvent;
  error: SpeechRecognitionErrorEvent;
};
