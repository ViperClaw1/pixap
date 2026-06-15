import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import type { ProfileStackParamList } from "@/app/navigation/types";
import { navigateToPublicProfile } from "@/app/navigation/navigationHelpers";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  useAdminContentReports,
  useUpdateContentReportStatus,
  type AdminContentReport,
  type AdminReportStatusFilter,
} from "@/entities/admin-moderation";
import {
  AdminModerationGuard,
  ModerationReportCard,
  ModerationStatusFilter,
  canOpenModerationContent,
  navigateModerationContent,
} from "@/features/admin-moderation";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";
import { devWarn } from "@/shared/lib/devLog";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "AdminModeration">;

function AdminModerationContent() {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const styles = useThemeStyles(createStyles);
  const [statusFilter, setStatusFilter] = useState<AdminReportStatusFilter>("pending");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useAdminContentReports(statusFilter);
  const updateStatus = useUpdateContentReportStatus();

  const reports = data?.reports ?? [];
  const pendingCount = data?.pending_count ?? 0;

  const resolveReport = useCallback(
    async (reportId: string, status: "reviewed" | "dismissed" | "action_taken") => {
      setUpdatingId(reportId);
      try {
        await updateStatus.mutateAsync({ reportId, status });
        Toast.show({
          type: "success",
          text1: t("adminModeration.toastResolved"),
        });
      } catch (error) {
        devWarn("admin moderation update failed", error);
        Toast.show({
          type: "error",
          text1: t("adminModeration.toastError"),
          text2: error instanceof Error ? error.message : t("common.unknownError"),
        });
      } finally {
        setUpdatingId(null);
      }
    },
    [t, updateStatus],
  );

  const onDismiss = useCallback(
    (reportId: string) => void resolveReport(reportId, "dismissed"),
    [resolveReport],
  );
  const onMarkReviewed = useCallback(
    (reportId: string) => void resolveReport(reportId, "reviewed"),
    [resolveReport],
  );
  const onActionTaken = useCallback(
    (reportId: string) => void resolveReport(reportId, "action_taken"),
    [resolveReport],
  );

  const onOpenReportedUser = useCallback(
    (userId: string) => {
      navigateToPublicProfile(navigation, userId, { viewerUserId: user?.id });
    },
    [navigation, user?.id],
  );

  const onOpenContent = useCallback(
    async (report: AdminContentReport) => {
      const opened = await navigateModerationContent(navigation, report, user?.id ?? null);
      if (!opened) {
        Toast.show({
          type: "error",
          text1: t("adminModeration.openContentFailed"),
        });
      }
    },
    [navigation, t, user?.id],
  );

  const renderItem = useCallback(
    ({ item }: { item: AdminContentReport }) => (
      <ModerationReportCard
        report={item}
        isUpdating={updatingId === item.id}
        onDismiss={onDismiss}
        onMarkReviewed={onMarkReviewed}
        onActionTaken={onActionTaken}
        onOpenReportedUser={onOpenReportedUser}
        onOpenContent={onOpenContent}
        canOpenContent={canOpenModerationContent(item)}
      />
    ),
    [onActionTaken, onDismiss, onMarkReviewed, onOpenContent, onOpenReportedUser, updatingId],
  );

  const keyExtractor = useCallback((item: AdminContentReport) => item.id, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.listHeader}>
        <ModerationStatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
          pendingCount={pendingCount}
        />
        {statusFilter === "pending" && pendingCount > 0 ? (
          <Text style={[styles.pendingHint, { color: colors.textMuted }]}>
            {t("adminModeration.pendingHint", { count: pendingCount })}
          </Text>
        ) : null}
      </View>
    ),
    [colors.textMuted, pendingCount, statusFilter, styles.listHeader, styles.pendingHint, t],
  );

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    if (isError) {
      return (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{t("adminModeration.error.title")}</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => void refetch()}>
            <Text style={[styles.retryText, { color: colors.onPrimary }]}>{t("adminModeration.error.retry")}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>{t("adminModeration.empty")}</Text>
      </View>
    );
  }, [colors, isError, isLoading, refetch, styles, t]);

  return (
    <FlashList
      removeClippedSubviews
      data={reports}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={200}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => void refetch()} />
      }
    />
  );
}

export default function AdminModerationPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemeStyles(createPageStyles);

  return (
    <View style={styles.page}>
      <AppHeader
        title={t("adminModeration.title")}
        leftIcon="chevron-back"
        onLeftPress={() => navigation.goBack()}
      />
      <AdminModerationGuard>
        <AdminModerationContent />
      </AdminModerationGuard>
    </View>
  );
}

function createPageStyles({ colors }: { colors: { background: string } }) {
  return StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
  });
}

function createStyles({
  colors,
}: {
  colors: { background: string; text: string; textMuted: string; primary: string; onPrimary: string };
}) {
  return StyleSheet.create({
    listContent: {
      paddingBottom: 24,
    },
    listHeader: {
      backgroundColor: colors.background,
    },
    pendingHint: {
      fontSize: 13,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    centered: {
      padding: 32,
      alignItems: "center",
      gap: 12,
    },
    emptyTitle: {
      fontSize: 15,
      textAlign: "center",
    },
    retryBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
    },
    retryText: {
      fontWeight: "700",
    },
  });
}
