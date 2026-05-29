import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { PlatformPressable } from "@react-navigation/elements";
import { Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/app/providers/AuthProvider";

const TAB_ICON_SIZE = 24;

/** Hides tab when user is not signed in; stable reference for screen options. */
export function AuthorizedTabBarButton(props: BottomTabBarButtonProps) {
  const { user } = useAuth();
  if (!user) return null;
  return <PlatformPressable {...props} />;
}

export function ProfileTabIcon({ focused, color }: { focused: boolean; color: string }) {
  const { user } = useAuth();
  const isAuthorized = Boolean(user);
  return (
    <Ionicons
      name={
        isAuthorized
          ? focused
            ? "person"
            : "person-outline"
          : focused
            ? "log-in"
            : "log-in-outline"
      }
      size={TAB_ICON_SIZE}
      color={color}
    />
  );
}

export function ProfileTabLabel({ color }: { color: string; focused: boolean }) {
  const { user } = useAuth();
  return (
    <Text style={{ color, fontSize: 11, fontWeight: "600" }}>
      {user ? "Profile" : "Login"}
    </Text>
  );
}

export const BOOKINGS_TAB_OPTIONS = {
  title: "Bookings",
  tabBarButton: AuthorizedTabBarButton,
};

export const CART_TAB_OPTIONS = {
  title: "Messages",
  tabBarButton: AuthorizedTabBarButton,
};

export const PROFILE_TAB_OPTIONS = {
  tabBarLabel: ProfileTabLabel,
  tabBarIcon: ProfileTabIcon,
};
