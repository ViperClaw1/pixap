import { useStaticWindowSize } from "@/shared/lib/useStaticWindowSize";
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AnalyticsPeriod } from "@/entities/admin-analytics";
import { useAdminAnalytics } from "@/entities/admin-analytics";
import {
  AdminDashboardGuard,
  AnalyticsBarChart,
  AnalyticsLineChart,
  AnalyticsPieChart,
  DashboardSection,
  DEFAULT_ANALYTICS_PERIOD,
  MetricCard,
  PeriodSelector,
} from "@/features/admin-dashboard";
import { AppHeader } from "@/shared/ui/app-header/AppHeader";
import { useThemeStyles } from "@/shared/theme/useThemeStyles";

function formatMrr(minor: number): string {
  return `$${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function AdminDashboardContent() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { width } = useStaticWindowSize();
  const styles = useThemeStyles(createStyles);
  const [period, setPeriod] = useState<AnalyticsPeriod>(DEFAULT_ANALYTICS_PERIOD);
  const { data, isLoading, isError, refetch, isFetching } = useAdminAnalytics(period);

  const metricRowGap = width > 400 ? 12 : 8;

  if (isLoading && !data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>{t("adminDashboard.loading")}</Text>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>{t("adminDashboard.error.title")}</Text>
        <Text style={styles.muted}>{t("adminDashboard.error.body")}</Text>
        <Pressable style={styles.retryBtn} onPress={() => void refetch()}>
          <Text style={styles.retryText}>{t("adminDashboard.error.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  const hasAnyData =
    data.registrations.series.length > 0 ||
    data.dau.series.length > 0 ||
    data.subscriptions.purchasesSeries.length > 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <PeriodSelector value={period} onChange={setPeriod} />
      {isFetching ? (
        <ActivityIndicator size="small" style={styles.fetching} />
      ) : null}
      {data.isMock ? (
        <Text style={styles.mockBanner}>{t("adminDashboard.mockDisclaimer")}</Text>
      ) : null}
      <Text style={styles.periodRange}>
        {t("adminDashboard.periodRange", { from: data.periodFrom, to: data.periodTo })}
      </Text>

      {!hasAnyData ? (
        <Text style={styles.empty}>{t("adminDashboard.empty")}</Text>
      ) : null}

      <DashboardSection
        title={t("adminDashboard.sections.registrations")}
        subtitle={t("adminDashboard.sections.registrationsSub")}
      >
        <View style={[styles.metricsRow, { gap: metricRowGap }]}>
          <MetricCard
            label={t("adminDashboard.registrations.total")}
            value={String(data.registrations.total)}
            trendPct={data.registrations.growthPct}
            subtitle={t("adminDashboard.registrations.growthHint")}
          />
        </View>
        <AnalyticsLineChart
          title={t("adminDashboard.charts.registrationsOverTime")}
          points={data.registrations.series}
          period={period}
        />
      </DashboardSection>

      <DashboardSection
        title={t("adminDashboard.sections.dau")}
        subtitle={t("adminDashboard.sections.dauSub")}
      >
        <View style={[styles.metricsRow, { gap: metricRowGap }]}>
          <MetricCard
            label={t("adminDashboard.dau.today")}
            value={String(data.dau.today)}
            trendPct={data.dau.vsPreviousPct}
          />
          <MetricCard
            label={t("adminDashboard.dau.avg7d")}
            value={String(data.dau.avg7d)}
            subtitle={t("adminDashboard.dau.avgHint")}
          />
        </View>
        <AnalyticsLineChart
          title={t("adminDashboard.charts.dauOverTime")}
          points={data.dau.series}
          period={period}
          area
        />
      </DashboardSection>

      <DashboardSection
        title={t("adminDashboard.sections.whatsapp")}
        subtitle={t("adminDashboard.sections.whatsappSub")}
      >
        <View style={[styles.metricsRow, { gap: metricRowGap }]}>
          <MetricCard
            label={t("adminDashboard.whatsapp.started")}
            value={String(data.whatsapp.campaignsStarted)}
          />
          <MetricCard
            label={t("adminDashboard.whatsapp.success")}
            value={String(data.whatsapp.successfulBookings)}
            subtitle={t("adminDashboard.whatsapp.conversion", {
              pct: data.whatsapp.conversionPct,
            })}
          />
          <MetricCard
            label={t("adminDashboard.whatsapp.successRate")}
            value={`${data.whatsapp.successRatePct}%`}
          />
        </View>
        <AnalyticsPieChart
          title={t("adminDashboard.charts.whatsappOutcomes")}
          outcomes={data.whatsapp.outcomes}
        />
        <AnalyticsBarChart
          title={t("adminDashboard.charts.whatsappBreakdown")}
          outcomes={data.whatsapp.outcomes}
        />
      </DashboardSection>

      <DashboardSection
        title={t("adminDashboard.sections.subscriptions")}
        subtitle={t("adminDashboard.sections.subscriptionsSub")}
      >
        <View style={[styles.metricsRow, { gap: metricRowGap }]}>
          <MetricCard
            label={t("adminDashboard.subscriptions.total")}
            value={String(data.subscriptions.totalPurchased)}
            trendPct={data.subscriptions.growthPct}
          />
          <MetricCard
            label={t("adminDashboard.subscriptions.mrr")}
            value={formatMrr(data.subscriptions.mrrCurrent)}
            subtitle={t("adminDashboard.subscriptions.mrrHint")}
          />
        </View>
        <AnalyticsLineChart
          title={t("adminDashboard.charts.purchasesOverTime")}
          points={data.subscriptions.purchasesSeries}
          period={period}
        />
        <AnalyticsLineChart
          title={t("adminDashboard.charts.mrrTrend")}
          points={data.subscriptions.mrrSeries}
          period={period}
          area
        />
      </DashboardSection>
    </ScrollView>
  );
}

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const styles = useThemeStyles(createPageStyles);

  return (
    <View style={styles.page}>
      <AppHeader
        title={t("adminDashboard.title")}
        leftIcon="chevron-back"
        onLeftPress={() => navigation.goBack()}
      />
      <AdminDashboardGuard>
        <AdminDashboardContent />
      </AdminDashboardGuard>
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
  colors: { background: string; text: string; textMuted: string; primary: string; onPrimary: string; accentSurface: string };
}) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { padding: 16, gap: 8 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
    muted: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
    errorTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
    retryBtn: {
      marginTop: 8,
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 10,
    },
    retryText: { color: colors.onPrimary, fontWeight: "700" },
    fetching: { alignSelf: "center", marginVertical: 4 },
    mockBanner: {
      fontSize: 11,
      color: colors.textMuted,
      backgroundColor: colors.accentSurface,
      padding: 10,
      borderRadius: 8,
      overflow: "hidden",
    },
    periodRange: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
    empty: { fontSize: 14, color: colors.textMuted, textAlign: "center", paddingVertical: 24 },
    metricsRow: { flexDirection: "row", flexWrap: "wrap" },
  });
}
