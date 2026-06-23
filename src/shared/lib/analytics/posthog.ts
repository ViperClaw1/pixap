import PostHog from "posthog-react-native";

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? "";
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

// No-op when key is not configured (dev / CI without env vars).
export const posthog = apiKey
  ? new PostHog(apiKey, { host, flushAt: 20, flushInterval: 30000 })
  : null;
