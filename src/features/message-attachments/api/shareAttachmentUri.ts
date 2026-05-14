import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 120) || "attachment";
}

/**
 * Opens the system share sheet so the user can save to Files / Photos / another app.
 * Remote http(s) URIs are downloaded to cache first.
 */
export async function shareAttachmentUri(uri: string, suggestedName?: string | null): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Sharing is not available on this device");
  }

  let localUri = uri;

  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const base = suggestedName?.trim() || `download_${Date.now()}`;
    const safe = sanitizeFileName(base.includes(".") ? base : `${base}.bin`);
    const dir = FileSystem.cacheDirectory;
    if (!dir) throw new Error("Cache directory is not available");
    const dest = `${dir}${safe}`;
    const result = await FileSystem.downloadAsync(uri, dest);
    localUri = result.uri;
  }

  await Sharing.shareAsync(localUri, { dialogTitle: "Save or share" });
}
