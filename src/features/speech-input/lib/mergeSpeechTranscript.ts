export function mergeSpeechTranscript(baseText: string, transcript: string): string {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return baseText;
  if (!baseText.trim()) return trimmedTranscript;
  const spacer = baseText.endsWith(" ") ? "" : " ";
  return `${baseText}${spacer}${trimmedTranscript}`;
}
