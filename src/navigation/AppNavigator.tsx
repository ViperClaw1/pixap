import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import { useAppTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import HomeScreen from "@/pages/home";
import MessagesScreen from "@/pages/messages";
import MessageThreadScreen from "@/pages/message-thread";
import BookingsScreen from "@/pages/bookings";
import ProfileScreen from "@/pages/profile";
import AuthScreen from "@/pages/auth";
import AuthEmailSentScreen from "@/pages/auth-email-sent";
import AuthEmailCallbackScreen from "@/pages/auth-email-callback";
import VerifyEmailOtpScreen from "@/pages/verify-email-otp";
import ResetPasswordScreen from "@/pages/reset-password";
import PasswordResetSentScreen from "@/pages/password-reset-sent";
import OAuthCallbackScreen from "@/pages/oauth-callback";
import PaymentSuccessScreen from "@/pages/payment-success";
import PaymentCanceledScreen from "@/pages/payment-canceled";
import PrivacyPolicyScreen from "@/pages/privacy-policy";
import EditProfileScreen from "@/pages/edit-profile";
import FavoritesScreen from "@/pages/favorites";
import NotFoundScreen from "@/pages/not-found";
import AdminImageUploadScreen from "@/pages/admin-image-upload";
import MyPurchasesScreen from "@/pages/my-purchases";
import StoriesFeedScreen from "@/pages/stories-feed";
import SearchScreen from "@/pages/search";
import { renderBrowseFlowScreens, type BrowseFlowStackScreen } from "./BrowseFlowScreens";

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const stackScreenOptions = { headerShown: false as const, animation: "slide_from_right" as const };
const fullWidthSwipeBackOptions = {
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
} as const;

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator initialRouteName="HomeMain" screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="SearchMain" component={SearchScreen} options={fullWidthSwipeBackOptions} />
      {renderBrowseFlowScreens(HomeStack.Screen as BrowseFlowStackScreen)}
      <HomeStack.Screen name="OAuthCallback" component={OAuthCallbackScreen} />
    </HomeStack.Navigator>
  );
}

function FeedStackNavigator() {
  return (
    <FeedStack.Navigator initialRouteName="FeedMain" screenOptions={stackScreenOptions}>
      <FeedStack.Screen name="FeedMain" component={StoriesFeedScreen} />
      {renderBrowseFlowScreens(FeedStack.Screen as BrowseFlowStackScreen)}
    </FeedStack.Navigator>
  );
}

function CartStackNavigator() {
  return (
    <CartStack.Navigator initialRouteName="CartMain" screenOptions={stackScreenOptions}>
      <CartStack.Screen name="CartMain" component={MessagesScreen} />
      <CartStack.Screen name="MessageThread" component={MessageThreadScreen} options={fullWidthSwipeBackOptions} />
      <CartStack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
      <CartStack.Screen name="PaymentCanceled" component={PaymentCanceledScreen} />
    </CartStack.Navigator>
  );
}

function BookingsStackNavigator() {
  return (
    <BookingsStack.Navigator initialRouteName="BookingsMain" screenOptions={stackScreenOptions}>
      <BookingsStack.Screen name="BookingsMain" component={BookingsScreen} />
      {renderBrowseFlowScreens(BookingsStack.Screen as BrowseFlowStackScreen)}
    </BookingsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator initialRouteName="ProfileMain" screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="MyPurchases" component={MyPurchasesScreen} />
      <ProfileStack.Screen name="Auth" component={AuthScreen} />
      <ProfileStack.Screen name="AuthEmailSent" component={AuthEmailSentScreen} />
      <ProfileStack.Screen name="AuthEmailCallback" component={AuthEmailCallbackScreen} />
      <ProfileStack.Screen name="VerifyEmailOtp" component={VerifyEmailOtpScreen} options={fullWidthSwipeBackOptions} />
      <ProfileStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <ProfileStack.Screen name="PasswordResetSent" component={PasswordResetSentScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} options={fullWidthSwipeBackOptions} />
      <ProfileStack.Screen name="Favorites" component={FavoritesScreen} options={fullWidthSwipeBackOptions} />
      <ProfileStack.Screen name="Privacy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="NotFound" component={NotFoundScreen} />
      <ProfileStack.Screen name="AdminImageUpload" component={AdminImageUploadScreen} />
      {renderBrowseFlowScreens(ProfileStack.Screen as BrowseFlowStackScreen)}
    </ProfileStack.Navigator>
  );
}

const TAB_ICON_SIZE = 24;

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const isAuthorized = Boolean(user);
  const androidTabLift = Platform.OS === "android" ? 8 : 0;
  const tabBottomPadding = Math.max(insets.bottom, 6) + androidTabLift;

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        /** Keep all tab routes mounted; conditional `<Tab.Screen />` null caused Android tab crashes. */
        tabBarButton:
          !isAuthorized && (route.name === "Bookings" || route.name === "Cart") ? () => null : undefined,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          paddingBottom: tabBottomPadding,
          paddingTop: 6,
          minHeight: 52 + tabBottomPadding,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarHideOnKeyboard: false,
        tabBarIcon: ({ focused, color }) => {
          const iconColor = color;
          switch (route.name) {
            case "Home":
              return (
                <Ionicons name={focused ? "home" : "home-outline"} size={TAB_ICON_SIZE} color={iconColor} />
              );
            case "Feed":
              return (
                <Ionicons name={focused ? "albums" : "albums-outline"} size={TAB_ICON_SIZE} color={iconColor} />
              );
            case "Cart":
              return (
                <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={TAB_ICON_SIZE} color={iconColor} />
              );
            case "Bookings":
              return (
                <Ionicons name={focused ? "calendar" : "calendar-outline"} size={TAB_ICON_SIZE} color={iconColor} />
              );
            case "Profile":
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
                  color={iconColor}
                />
              );
            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedStackNavigator} options={{ title: "Feed" }} />
      <Tab.Screen name="Bookings" component={BookingsStackNavigator} options={{ title: "Bookings" }} />
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: "Home" }} />
      <Tab.Screen name="Cart" component={CartStackNavigator} options={{ title: "Messages" }} />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={{ title: isAuthorized ? "Profile" : "Login" }}
      />
    </Tab.Navigator>
  );
}
