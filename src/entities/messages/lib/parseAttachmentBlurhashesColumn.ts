import { parseMediaBlurhashesColumn } from "@/shared/lib/parseMediaBlurhashesColumn";

/** Parses `messages.attachment_blurhashes` (parallel to `attachments[]`). */
export function parseAttachmentBlurhashesColumn(raw: unknown): (string | null)[] | null {
  return parseMediaBlurhashesColumn(raw);
}
