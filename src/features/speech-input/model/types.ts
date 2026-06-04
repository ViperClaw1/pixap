export type VoiceTranscriptMeta = {
  isFinal: boolean;
};

export type VoiceTranscriptHandler = (text: string, meta: VoiceTranscriptMeta) => void;
