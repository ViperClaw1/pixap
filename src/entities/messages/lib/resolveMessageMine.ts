export type SupportThreadMeta = {
  kind: "support";
  supportUserId: string;
};

export type MessageMineContext = {
  viewerId: string;
  senderId: string;
  threadMeta: SupportThreadMeta | null;
  viewerIsSupportStaff: boolean;
};

/** Support staff see all non-customer messages in a support thread as outgoing (shared inbox). */
export function resolveMessageMine(ctx: MessageMineContext): boolean {
  if (ctx.senderId === ctx.viewerId) return true;
  if (
    ctx.viewerIsSupportStaff &&
    ctx.threadMeta?.kind === "support" &&
    ctx.senderId !== ctx.threadMeta.supportUserId
  ) {
    return true;
  }
  return false;
}
