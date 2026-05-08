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
import PlaceDetailScreen from "@/pages/place-detail";
import CategoryScreen from "@/pages/category";
import ShoppingItemsScreen from "@/pages/shopping-items";
import BookingFlowScreen from "@/pages/booking-flow";
import AIBookingScreen from "@/pages/ai-booking";
import VibeMatchScreen from "@/pages/vibe-match";
import AuthScreen from "@/pages/auth";
import AuthEmailSentScreen from "@/pages/auth-email-sent";
import AuthEmailCallbackScreen from "@/pages/auth-email-callback";
import ResetPasswordScreen from "@/pages/reset-password";
import OAuthCallbackScreen from "@/pages/oauth-callback";
import PaymentSuccessScreen from "@/pages/payment-success";
import PaymentCanceledScreen from "@/pages/payment-canceled";
import PrivacyPolicyScreen from "@/pages/privacy-policy";
import EditProfileScreen from "@/pages/edit-profile";
import FavoritesScreen from "@/pages/favorites";
import NotFoundScreen from "@/pages/not-found";
import AdminImageUploadScreen from "@/pages/admin-image-upload";
import MyPurchasesScreen from "@/pages/my-purchases";
import StoryViewerScreen from "@/pages/story-viewer";
import StoryComposerScreen from "@/pages/story-composer";
import StoryDiscussionScreen from "@/pages/story-discussion";
import StoriesFeedScreen from "@/pages/stories-feed";
import SubscriptionPaywallScreen from "@/pages/subscription-paywall";
import SearchScreen from "@/pages/search";

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const FeedStack = createNativeStackNavigator<FeedStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const BookingsStack = createNativeStackNavigator<BookingsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

const stackScreenOptions = { headerShown: false as const, animation: "slide_from_right" as const };

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator initialRouteName="HomeMain" screenOptions={stackScreenOptions}>
      <HomeStack.Screen name="HomeMain" component={HomeScreen} />
      <HomeStack.Screen name="SearchMain" component={SearchScreen} />
      <HomeStack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      <HomeStack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ presentation: "fullScreenModal" }} />
      <HomeStack.Screen name="StoryComposer" component={StoryComposerScreen} options={{ presentation: "fullScreenModal" }} />
      <HomeStack.Screen name="StoryDiscussion" component={StoryDiscussionScreen} />
      <HomeStack.Screen name="Category" component={CategoryScreen} />
      <HomeStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <HomeStack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <HomeStack.Screen name="AIBooking" component={AIBookingScreen} />
      <HomeStack.Screen name="VibeMatch" component={VibeMatchScreen} />
      <HomeStack.Screen name="SubscriptionPaywall" component={SubscriptionPaywallScreen} />
      <HomeStack.Screen name="OAuthCallback" component={OAuthCallbackScreen} />
    </HomeStack.Navigator>
  );
}

function FeedStackNavigator() {
  return (
    <FeedStack.Navigator initialRouteName="FeedMain" screenOptions={stackScreenOptions}>
      <FeedStack.Screen name="FeedMain" component={StoriesFeedScreen} />
      <FeedStack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      <FeedStack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ presentation: "fullScreenModal" }} />
      <FeedStack.Screen name="StoryComposer" component={StoryComposerScreen} options={{ presentation: "fullScreenModal" }} />
      <FeedStack.Screen name="StoryDiscussion" component={StoryDiscussionScreen} />
      <FeedStack.Screen name="Category" component={CategoryScreen} />
      <FeedStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <FeedStack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <FeedStack.Screen name="AIBooking" component={AIBookingScreen} />
      <FeedStack.Screen name="VibeMatch" component={VibeMatchScreen} />
      <FeedStack.Screen name="SubscriptionPaywall" component={SubscriptionPaywallScreen} />
    </FeedStack.Navigator>
  );
}

function CartStackNavigator() {
  return (
    <CartStack.Navigator initialRouteName="CartMain" screenOptions={stackScreenOptions}>
      <CartStack.Screen name="CartMain" component={MessagesScreen} />
      <CartStack.Screen name="MessageThread" component={MessageThreadScreen} />
      <CartStack.Screen name="PaymentSuccess" component={PaymentSuccessScreen} />
      <CartStack.Screen name="PaymentCanceled" component={PaymentCanceledScreen} />
    </CartStack.Navigator>
  );
}

function BookingsStackNavigator() {
  return (
    <BookingsStack.Navigator initialRouteName="BookingsMain" screenOptions={stackScreenOptions}>
      <BookingsStack.Screen name="BookingsMain" component={BookingsScreen} />
      <BookingsStack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      <BookingsStack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ presentation: "fullScreenModal" }} />
      <BookingsStack.Screen name="StoryComposer" component={StoryComposerScreen} options={{ presentation: "fullScreenModal" }} />
      <BookingsStack.Screen name="StoryDiscussion" component={StoryDiscussionScreen} />
      <BookingsStack.Screen name="Category" component={CategoryScreen} />
      <BookingsStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <BookingsStack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <BookingsStack.Screen name="AIBooking" component={AIBookingScreen} />
      <BookingsStack.Screen name="VibeMatch" component={VibeMatchScreen} />
      <BookingsStack.Screen name="SubscriptionPaywall" component={SubscriptionPaywallScreen} />
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
      <ProfileStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="Favorites" component={FavoritesScreen} />
      <ProfileStack.Screen name="Privacy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="NotFound" component={NotFoundScreen} />
      <ProfileStack.Screen name="AdminImageUpload" component={AdminImageUploadScreen} />
      <ProfileStack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      <ProfileStack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ presentation: "fullScreenModal" }} />
      <ProfileStack.Screen name="StoryComposer" component={StoryComposerScreen} options={{ presentation: "fullScreenModal" }} />
      <ProfileStack.Screen name="StoryDiscussion" component={StoryDiscussionScreen} />
      <ProfileStack.Screen name="Category" component={CategoryScreen} />
      <ProfileStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <ProfileStack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <ProfileStack.Screen name="AIBooking" component={AIBookingScreen} />
      <ProfileStack.Screen name="VibeMatch" component={VibeMatchScreen} />
      <ProfileStack.Screen name="SubscriptionPaywall" component={SubscriptionPaywallScreen} />
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
                <Ionicons name={focused ? "person" : "person-outline"} size={TAB_ICON_SIZE} color={iconColor} />
              );
            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedStackNavigator} options={{ title: "Feed" }} />
      {isAuthorized ? <Tab.Screen name="Bookings" component={BookingsStackNavigator} options={{ title: "Bookings" }} /> : null}
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: "Home" }} />
      {isAuthorized ? <Tab.Screen name="Cart" component={CartStackNavigator} options={{ title: "Messages" }} /> : null}
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}
