import { env } from "@/shared/lib/env";

type TranscribeAudioResponse = {
  text?: string;
  error?: string;
};

const DEFAULT_FILENAME = "recording.m4a";
const DEFAULT_MIME_TYPE = "audio/mp4";

function buildAudioFormData(uri: string, lang?: string): FormData {
  const form = new FormData();
  form.append("audio", {
    uri,
    name: DEFAULT_FILENAME,
    type: DEFAULT_MIME_TYPE,
  } as unknown as Blob);
  if (lang) {
    form.append("lang", lang);
  }
  return form;
}

export async function transcribeAudioFile(uri: string, lang?: string): Promise<string> {
  const result = await fetch(`${env.supabaseUrl}/functions/v1/transcribe-audio`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      apikey: env.supabaseAnonKey,
    },
    body: buildAudioFormData(uri, lang),
  });

  const bodyText = await result.text();
  let data: TranscribeAudioResponse | null = null;
  if (bodyText) {
    try {
      data = JSON.parse(bodyText) as TranscribeAudioResponse;
    } catch {
      data = null;
    }
  }

  if (!result.ok) {
    throw new Error(data?.error ?? `Transcription failed: ${result.status}`);
  }

  const text = data?.text?.trim();
  if (!text) {
    throw new Error("Transcription returned empty text");
  }
  return text;
}
