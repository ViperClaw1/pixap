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
import HomeScreen from "@/screens/HomeScreen";
import CartScreen from "@/screens/CartScreen";
import BookingsScreen from "@/screens/BookingsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import PlaceDetailScreen from "@/screens/PlaceDetailScreen";
import CategoryScreen from "@/screens/CategoryScreen";
import ShoppingItemsScreen from "@/screens/ShoppingItemsScreen";
import BookingFlowScreen from "@/screens/BookingFlowScreen";
import AIBookingScreen from "@/screens/AIBookingScreen";
import AuthScreen from "@/screens/AuthScreen";
import ResetPasswordScreen from "@/screens/ResetPasswordScreen";
import OAuthCallbackScreen from "@/screens/OAuthCallbackScreen";
import PaymentSuccessScreen from "@/screens/PaymentSuccessScreen";
import PaymentCanceledScreen from "@/screens/PaymentCanceledScreen";
import PrivacyPolicyScreen from "@/screens/PrivacyPolicyScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import FavoritesScreen from "@/screens/FavoritesScreen";
import NotFoundScreen from "@/screens/NotFoundScreen";
import AdminImageUploadScreen from "@/screens/AdminImageUploadScreen";
import MyPurchasesScreen from "@/screens/MyPurchasesScreen";
import StoryViewerScreen from "@/screens/StoryViewerScreen";
import StoryComposerScreen from "@/screens/StoryComposerScreen";
import StoryDiscussionScreen from "@/screens/StoryDiscussionScreen";
import StoriesFeedScreen from "@/screens/StoriesFeedScreen";
import SubscriptionPaywallScreen from "@/screens/SubscriptionPaywallScreen";

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
      <HomeStack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      <HomeStack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ presentation: "fullScreenModal" }} />
      <HomeStack.Screen name="StoryComposer" component={StoryComposerScreen} options={{ presentation: "fullScreenModal" }} />
      <HomeStack.Screen name="StoryDiscussion" component={StoryDiscussionScreen} />
      <HomeStack.Screen name="Category" component={CategoryScreen} />
      <HomeStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <HomeStack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <HomeStack.Screen name="AIBooking" component={AIBookingScreen} />
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
      <FeedStack.Screen name="SubscriptionPaywall" component={SubscriptionPaywallScreen} />
    </FeedStack.Navigator>
  );
}

function CartStackNavigator() {
  return (
    <CartStack.Navigator initialRouteName="CartMain" screenOptions={stackScreenOptions}>
      <CartStack.Screen name="CartMain" component={CartScreen} />
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
      <ProfileStack.Screen name="SubscriptionPaywall" component={SubscriptionPaywallScreen} />
    </ProfileStack.Navigator>
  );
}

const TAB_ICON_SIZE = 24;

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
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
        tabBarHideOnKeyboard: true,
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
                <Ionicons name={focused ? "cart" : "cart-outline"} size={TAB_ICON_SIZE} color={iconColor} />
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
      <Tab.Screen name="Home" component={HomeStackNavigator} options={{ title: "Home" }} />
      <Tab.Screen name="Feed" component={FeedStackNavigator} options={{ title: "Feed" }} />
      <Tab.Screen name="Cart" component={CartStackNavigator} options={{ title: "Cart" }} />
      <Tab.Screen name="Bookings" component={BookingsStackNavigator} options={{ title: "Bookings" }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}
