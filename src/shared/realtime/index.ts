export { RealtimeConnectionManager, isRealtimeChannelSubscribed } from "./connectionManager";
export type { CreateRealtimeChannel, RealtimeChannelStatus } from "./connectionManager";
export { useRealtimeChannel } from "./useRealtimeChannel";
export { subscribeRealtimeAuthLifecycle } from "./subscribeRealtimeAuth";
export { realtimeEventBus } from "./eventBus";
export type { RealtimeEvent, NotificationRow, MessageRow, PostRow, AiGenerationJobRow } from "./events";
export { listHasId } from "./dedupe";
export { computeBackoffMs } from "./reconnectPolicy";
export {
  recordRealtimeReconnect,
  recordRealtimeChannelStatus,
  getRealtimePerfSnapshot,
  resetRealtimePerfForTests,
} from "./realtimePerf";
export type { RealtimeChannelScope } from "./realtimePerf";
