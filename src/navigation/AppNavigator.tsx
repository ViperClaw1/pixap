import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type {
  BookingsStackParamList,
  CartStackParamList,
  HomeStackParamList,
  ProfileStackParamList,
  RootTabParamList,
  SearchStackParamList,
} from "./types";
import { useAppTheme } from "@/contexts/ThemeContext";
import HomeScreen from "@/screens/HomeScreen";
import SearchScreen from "@/screens/SearchScreen";
import CartScreen from "@/screens/CartScreen";
import BookingsScreen from "@/screens/BookingsScreen";
import ProfileScreen from "@/screens/ProfileScreen";
import PlaceDetailScreen from "@/screens/PlaceDetailScreen";
import CategoryScreen from "@/screens/CategoryScreen";
import ShoppingItemsScreen from "@/screens/ShoppingItemsScreen";
import BookingFlowScreen from "@/screens/BookingFlowScreen";
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

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const SearchStack = createNativeStackNavigator<SearchStackParamList>();
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
      <HomeStack.Screen name="Category" component={CategoryScreen} />
      <HomeStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <HomeStack.Screen name="BookingFlow" component={BookingFlowScreen} />
      <HomeStack.Screen name="OAuthCallback" component={OAuthCallbackScreen} />
    </HomeStack.Navigator>
  );
}

function SearchStackNavigator() {
  return (
    <SearchStack.Navigator initialRouteName="SearchMain" screenOptions={stackScreenOptions}>
      <SearchStack.Screen name="SearchMain" component={SearchScreen} />
      <SearchStack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      <SearchStack.Screen name="Category" component={CategoryScreen} />
      <SearchStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <SearchStack.Screen name="BookingFlow" component={BookingFlowScreen} />
    </SearchStack.Navigator>
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
      <BookingsStack.Screen name="Category" component={CategoryScreen} />
      <BookingsStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <BookingsStack.Screen name="BookingFlow" component={BookingFlowScreen} />
    </BookingsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator initialRouteName="ProfileMain" screenOptions={stackScreenOptions}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
      <ProfileStack.Screen name="Auth" component={AuthScreen} />
      <ProfileStack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <ProfileStack.Screen name="EditProfile" component={EditProfileScreen} />
      <ProfileStack.Screen name="Favorites" component={FavoritesScreen} />
      <ProfileStack.Screen name="Privacy" component={PrivacyPolicyScreen} />
      <ProfileStack.Screen name="NotFound" component={NotFoundScreen} />
      <ProfileStack.Screen name="AdminImageUpload" component={AdminImageUploadScreen} />
      <ProfileStack.Screen name="PlaceDetail" component={PlaceDetailScreen} />
      <ProfileStack.Screen name="Category" component={CategoryScreen} />
      <ProfileStack.Screen name="ShoppingItems" component={ShoppingItemsScreen} />
      <ProfileStack.Screen name="BookingFlow" component={BookingFlowScreen} />
    </ProfileStack.Navigator>
  );
}

const TAB_ICON_SIZE = 24;

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();

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
          paddingBottom: Math.max(insets.bottom, 6),
          paddingTop: 6,
          minHeight: 52 + Math.max(insets.bottom, 6),
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
            case "Search":
              return (
                <Ionicons name={focused ? "search" : "search-outline"} size={TAB_ICON_SIZE} color={iconColor} />
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
      <Tab.Screen name="Search" component={SearchStackNavigator} options={{ title: "Search" }} />
      <Tab.Screen name="Cart" component={CartStackNavigator} options={{ title: "Cart" }} />
      <Tab.Screen name="Bookings" component={BookingsStackNavigator} options={{ title: "Bookings" }} />
      <Tab.Screen name="Profile" component={ProfileStackNavigator} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}
