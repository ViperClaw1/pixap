import { corsHeaders } from "../_shared/cors.ts";

type GroqTranscriptionResponse = {
  text?: string;
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")?.trim() ?? "";
const GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = Deno.env.get("GROQ_WHISPER_MODEL")?.trim() || "whisper-large-v3-turbo";
const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
const FALLBACK_LANGUAGE = "ru";
const SUPPORTED_LANGUAGES = new Set(["ru", "en", "es", "pt", "fr", "de"]);

class TranscriptionServiceError extends Error {
  constructor() {
    super("Transcription service error");
  }
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeLanguage(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return FALLBACK_LANGUAGE;
  const language = value.trim().split("-")[0]?.toLowerCase();
  if (!language || !SUPPORTED_LANGUAGES.has(language)) return FALLBACK_LANGUAGE;
  return language;
}

async function transcribeWithGroq(audioFile: File, language: string): Promise<string> {
  const form = new FormData();
  form.append("file", audioFile, audioFile.name || "audio.m4a");
  form.append("model", GROQ_MODEL);
  form.append("language", language);
  form.append("response_format", "json");

  const response = await fetch(GROQ_TRANSCRIPTION_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("Groq transcription error", response.status, body.slice(0, 600));
    throw new TranscriptionServiceError();
  }

  const data = (await response.json()) as GroqTranscriptionResponse;
  return data.text?.trim() ?? "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return jsonResponse({ error: "Expected multipart/form-data" }, 400);
  }

  try {
    const form = await req.formData();
    const audioField = form.get("audio");
    if (!(audioField instanceof File)) {
      return jsonResponse({ error: "Missing audio field" }, 400);
    }

    if (audioField.size <= 0) {
      return jsonResponse({ error: "Audio file is empty" }, 400);
    }

    if (audioField.size > MAX_AUDIO_BYTES) {
      return jsonResponse({ error: "Audio file is too large" }, 413);
    }

    const language = normalizeLanguage(form.get("lang"));
    if (!GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not configured");
      return jsonResponse({ error: "Transcription service is not configured" }, 503);
    }

    const text = await transcribeWithGroq(audioField, language);
    return jsonResponse({ text });
  } catch (error) {
    console.error("transcribe-audio error", error);
    if (error instanceof TranscriptionServiceError) {
      return jsonResponse({ error: "Transcription service error" }, 502);
    }
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
