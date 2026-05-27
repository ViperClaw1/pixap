export function isOptimisticDiscussionId(id: string): boolean {
  return id.startsWith("optimistic-");
}
