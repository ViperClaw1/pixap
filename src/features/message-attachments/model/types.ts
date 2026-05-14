export type AttachmentKind = "image" | "video" | "file";

export type MessageAttachmentDraft = {
  uri: string;
  mimeType?: string | null;
  name?: string | null;
};
