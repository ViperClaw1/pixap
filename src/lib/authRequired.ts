import { CommonActions, type NavigationProp, type ParamListBase } from "@react-navigation/native";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error ?? "").toLowerCase();
}

export function isAuthRequiredError(error: unknown): boolean {
  const message = errorMessage(error);
  if (
    message.includes("authentication required") ||
    message.includes("not signed in") ||
    message.includes("sign in required") ||
    message.includes("not authenticated") ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("invalid jwt") ||
    message.includes("jwt expired")
  ) {
    return true;
  }

  const maybeStatus =
    error && typeof error === "object" && "status" in error
      ? (error as { status?: number }).status
      : undefined;
  if (maybeStatus === 401) return true;

  const maybeContext =
    error && typeof error === "object" && "context" in error
      ? (error as { context?: unknown }).context
      : undefined;
  if (maybeContext instanceof Response && maybeContext.status === 401) return true;

  return false;
}

export function navigateToAuthScreen(navigation: NavigationProp<ParamListBase>): void {
  const parent = navigation.getParent();
  if (parent) {
    parent.dispatch(
      CommonActions.navigate({
        name: "Profile",
        params: { screen: "Auth" },
      }),
    );
    return;
  }
  navigation.dispatch(
    CommonActions.navigate({
      name: "Profile",
      params: { screen: "Auth" },
    }),
  );
}
