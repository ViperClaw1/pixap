import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, type NavigationProp, type ParamListBase } from "@react-navigation/native";
import { useAuth } from "@/app/providers/AuthProvider";
import { isCartStackNavigation } from "@/app/navigation/navigationHelpers";
import { directThreadQueryOptions, invalidateMessagesInbox } from "@/entities/messages/lib/ensureDirectThread";

type Params = {
  threadId: string;
  peerId: string;
  isSupport?: boolean;
};

export function useResolvedMessageThreadId(params: Params) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const userId = user?.id ?? null;
  const hasThreadId = params.threadId.trim().length > 0;
  const shouldResolve = !params.isSupport && !hasThreadId && !!params.peerId && !!userId;

  const directThreadQuery = useQuery({
    ...directThreadQueryOptions(userId ?? "", params.peerId),
    enabled: shouldResolve,
  });

  useEffect(() => {
    if (!directThreadQuery.isSuccess || !directThreadQuery.data.created) return;
    void invalidateMessagesInbox(queryClient);
  }, [directThreadQuery.data?.created, directThreadQuery.isSuccess, queryClient]);

  useEffect(() => {
    if (!shouldResolve || !directThreadQuery.isError) return;
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    if (isCartStackNavigation(navigation)) {
      navigation.reset({ index: 0, routes: [{ name: "CartMain" }] });
    }
  }, [directThreadQuery.isError, navigation, shouldResolve]);

  const resolvedThreadId = hasThreadId ? params.threadId : (directThreadQuery.data?.threadId ?? "");
  const isResolvingThread = shouldResolve && !resolvedThreadId && directThreadQuery.isPending;

  return {
    threadId: resolvedThreadId,
    isResolvingThread,
    resolveError: directThreadQuery.error,
  };
}
