import { useStorageEgressMetricsDev } from "@/shared/lib/useStorageEgressMetricsDev";

/** Dev-only provider fragment — no children wrapper needed. */
export function StorageEgressMetricsDev() {
  useStorageEgressMetricsDev();
  return null;
}
