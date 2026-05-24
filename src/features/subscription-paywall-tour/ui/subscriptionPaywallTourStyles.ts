import { StyleSheet } from "react-native";

export const subscriptionPaywallTourStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  carousel: {
    flex: 1,
  },
  slide: {
    flex: 1,
    paddingHorizontal: 12,
  },
  screenshot: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  description: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  backButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "transparent",
  },
  backButtonDisabled: {
    opacity: 0.35,
  },
  nextButton: {
    backgroundColor: "#FF7043",
  },
  actionText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
