import { useCallback } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { RouteProp } from "@react-navigation/native";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type {
  BookingsStackParamList,
  CartStackParamList,
  FeedStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
  RootTabParamList,
} from "./types";
import { useAppTheme } from "@/app/providers/ThemeProvider";
import { useAuth } from "@/app/providers/AuthProvider";
import OAuthCallbackScreen from "@/pages/oauth-callback";
import PrivacyPolicyScreen from "@/pages/privacy-policy";
import NotFoundScreen from "@/pages/not-found";
import { browseFlowSwipeBackOptions } from "./stackGestureOptions";
import { renderBrowseFlowScreens, type BrowseFlowStackScreen } from "./BrowseFlowScreens";
import { ensureMessagesScreensReady } from "@/pages/messages/lib/prefetchMessagesScreen";
import { BOOKINGS_TAB_OPTIONS, CART_TAB_OPTIONS, PROFILE_TAB_OPTIONS } from "./tabBarButtons";
import { resetCartStackToMain } from "./navigationHelpers";

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const stackScreenOptions = {
  headerShown: false as const,
  animation: "slide_from_right" as const,
  /** Native stack: freeze hidden routes when `enableFreeze(true)` (see index.ts). Story modals override with false in BrowseFlowScreens. */
  freezeOnBlur: true as const,
};
const fullWidthSwipeBackOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
} as const;

/** Story viewer overlay (Cart stack deep link). */
const storyOverlayModalOptions = {
  presentation: "transparentModal" as const,
  freezeOnBlur: false as const,
  gestureEnabled: false,
  animation: "fade" as const,
  contentStyle: { backgroundColor: "transparent" },
};

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator initialRouteName="HomeMain" screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="HomeMain" getComponent={() => require("@/pages/home").default} />
      <HomeStack.Screen name="SearchMain" getComponent={() => require("@/pages/search").default} options={fullWidthSwipeBackOptions} />
      <HomeStack.Screen
        name="DailyRecommendations"
        getComponent={() => require("@/pages/daily-recommendations").default}
        options={browseFlowSwipeBackOptions}
      />
      {renderBrowseFlowScreens(HomeStack.Screen as BrowseFlowStackScreen)}
      <HomeStack.Screen name="OAuthCallback" component={OAuthCallbackScreen} />
    </HomeStack.Navigator>
  );
}

function FeedStackNavigator() {
  return (
    <FeedStack.Navigator initialRouteName="FeedMain" screenOptions={stackScreenOptions}>
      <FeedStack.Screen name="FeedMain" getComponent={() => require("@/pages/stories-feed").default} />
      {renderBrowseFlowScreens(FeedStack.Screen as BrowseFlowStackScreen)}
    </FeedStack.Navigator>
  );
}

function CartStackNavigator() {
  return (
    <CartStack.Navigator initialRouteName="CartMain" screenOptions={stackScreenOptions}>
      <CartStack.Screen name="CartMain" getComponent={() => require("@/pages/messages").default} />
      <CartStack.Screen
        name="PublicProfile"
        getComponent={() => require("@/pages/public-profile").default}
        options={fullWidthSwipeBackOptions}
      />
      <CartStack.Screen
        name="MessageThread"
        getComponent={() => require("@/pages/message-thread").default}
        options={fullWidthSwipeBackOptions}
      />
      <CartStack.Screen
        name="FeedStoryViewer"
        getComponent={() => require("@/pages/feed-story-viewer").default}
        options={storyOverlayModalOptions}
      />
      <CartStack.Screen name="PaymentSuccess" getComponent={() => require("@/pages/payment-success").default} />
      <CartStack.Screen name="PaymentCanceled" getComponent={() => require("@/pages/payment-canceled").default} />
    </CartStack.Navigator>
  );
}

function BookingsStackNavigator() {
  return (
    <BookingsStack.Navigator initialRouteName="BookingsMain" screenOptions={stackScreenOptions}>
      <BookingsStack.Screen name="BookingsMain" getComponent={() => require("@/pages/bookings").default} />
      {renderBrowseFlowScreens(BookingsStack.Screen as BrowseFlowStackScreen)}
    </BookingsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator initialRouteName="ProfileMain" screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="ProfileMain" getComponent={() => require("@/pages/profile").default} />
      <ProfileStack.Screen name="MyPurchases" getComponent={() => require("@/pages/my-purchases").default} />
      <ProfileStack.Screen name="Auth" getComponent={() => require("@/pages/auth").default} />
      <ProfileStack.Screen name="AuthEmailSent" getComponent={() => require("@/pages/auth-email-sent").default} />
      <ProfileStack.Screen name="AuthEmailCallback" getComponent={() => require("@/pages/auth-email-callback").default} />
      <ProfileStack.Screen
        name="VerifyEmailOtp"
        getComponent={() => require("@/pages/verify-email-otp").default}
        options={fullWidthSwipeBackOptions}
      />
      <ProfileStack.Screen name="ResetPassword" getComponent={() => require("@/pages/reset-password").default} />
      <ProfileStack.Screen name="PasswordResetSent" getComponent={() => require("@/pages/password-reset-sent").default} />
      <ProfileStack.Screen
        name="PreferenceOnboarding"
        getComponent={() => require("@/pages/preference-onboarding").default}
        options={{ gestureEnabled: false }}
      />
      <ProfileStack.Screen name="Favorites" getComponent={() => require("@/pages/favorites").default} options={fullWidthSwipeBackOptions} />
      <ProfileStack.Screen name="Privacy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="NotFound" component={NotFoundScreen} />
      <ProfileStack.Screen name="AdminImageUpload" getComponent={() => require("@/pages/admin-image-upload").default} />
      <ProfileStack.Screen name="AdminModeration" getComponent={() => require("@/pages/admin-moderation").default} options={fullWidthSwipeBackOptions} />
      <ProfileStack.Screen name="AdminDashboard" getComponent={() => require("@/pages/admin-dashboard").default} options={fullWidthSwipeBackOptions} />
      {renderBrowseFlowScreens(ProfileStack.Screen as BrowseFlowStackScreen)}
    </ProfileStack.Navigator>
  );
}

const TAB_ICON_SIZE = 24;
const GUEST_HIDDEN_TAB_NAMES = new Set<keyof RootTabParamList>(["Bookings", "Cart"]);

function guestTabBarItemStyle(routeName: keyof RootTabParamList, isLoggedIn: boolean) {
  if (isLoggedIn) return undefined;
  if (GUEST_HIDDEN_TAB_NAMES.has(routeName)) {
    return {
      display: "none" as const,
      width: 0,
      minWidth: 0,
      maxWidth: 0,
      flex: 0,
      padding: 0,
      margin: 0,
      overflow: "hidden" as const,
    };
  }
  return { flex: 1, alignItems: "center" as const };
}

/**
 * Release / manual regression (Android release build):
 * - Cold start to first interactive frame; switch Home, Feed, Bookings, Profile, Messages 5 cycles.
 * - Open StoryViewer / FeedStoryViewer / StoryComposer, dismiss — feed grid must not fully remount (transparentModal).
 * - Open BookingFlow, AIBooking from Home; back gesture.
 * - Profile: VerifyEmailOtp after tab switch if freeze caused stuck input.
 * - Tabs: `detachInactiveScreens` is explicit; per-tab `lazy` defaults to true in @react-navigation/bottom-tabs (first visit mounts stack).
 */
export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const isLoggedIn = Boolean(user);
  const androidTabLift = Platform.OS === "android" ? 8 : 0;
  const tabBottomPadding = Math.max(insets.bottom, 6) + androidTabLift;

  const tabScreenOptions = useCallback(
    ({ route }: { route: RouteProp<RootTabParamList, keyof RootTabParamList> }) => ({
      headerShown: false,
      /** Bottom tabs: freeze inactive tab scenes (react-native-screens + react-freeze). */
      freezeOnBlur: true,
      tabBarActiveTintColor: colors.tabActive,
      tabBarInactiveTintColor: colors.tabInactive,
      tabBarStyle: {
        backgroundColor: colors.tabBar,
        borderTopColor: colors.border,
        paddingBottom: tabBottomPadding,
        paddingTop: 6,
        minHeight: 52 + tabBottomPadding,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600" as const },
      tabBarItemStyle: guestTabBarItemStyle(route.name, isLoggedIn),
      tabBarHideOnKeyboard: false,
      tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => {
        const iconColor = color;
        switch (route.name) {
          case "Home":
            return <Ionicons name={focused ? "home" : "home-outline"} size={TAB_ICON_SIZE} color={iconColor} />;
          case "Feed":
            return <Ionicons name={focused ? "albums" : "albums-outline"} size={TAB_ICON_SIZE} color={iconColor} />;
          case "Cart":
            return <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={TAB_ICON_SIZE} color={iconColor} />;
          case "Bookings":
            return <Ionicons name={focused ? "calendar" : "calendar-outline"} size={TAB_ICON_SIZE} color={iconColor} />;
          default:
            return null;
        }
      },
    }),
    [colors.border, colors.tabActive, colors.tabBar, colors.tabInactive, isLoggedIn, tabBottomPadding],
  );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      detachInactiveScreens={false}
      screenOptions={tabScreenOptions}
    >
      <Tab.Screen name="Feed" component={FeedStackNavigator} options={{ title: "Feed" }} />
      <Tab.Screen name="Bookings" component={BookingsStackNavigator} options={BOOKINGS_TAB_OPTIONS} />
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: "Home" }} />
      <Tab.Screen
        name="Cart"
        component={CartStackNavigator}
        options={CART_TAB_OPTIONS}
        listeners={({ navigation }) => ({
          tabPress: () => {
            ensureMessagesScreensReady();
            resetCartStackToMain(navigation);
          },
        })}
      />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={PROFILE_TAB_OPTIONS} />
    </Tab.Navigator>
  );
}
