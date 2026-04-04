import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/contexts/ThemeContext";
import { useCreateCartItem } from "@/hooks/useCartItems";
import { usePixAI, type PixAIFlowPayload, type PixAIPlace, type PixAISlot } from "@/hooks/usePixAI";
import { useAuth } from "@/contexts/AuthContext";
import AuthScreen from "@/screens/AuthScreen";
import { navigateToCartMain } from "@/navigation/navigationHelpers";
import { useNavigation } from "@react-navigation/native";
import type { NavigationProp, ParamListBase } from "@react-navigation/native";
import { ALL_CITIES_OPTION, useAvailableCities } from "@/hooks/useBusinessCards";
import { useCategories } from "@/hooks/useCategories";
import { useProfile } from "@/hooks/useProfile";
import { BottomSheetPickerModal } from "@/components/BottomSheetPickerModal";
import { SmartImage } from "@/components/SmartImage";

type DraftForm = {
  persons: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  comment: string;
};

const PHONE_REGEX = /^\d-\(\d{3}\)-\d{3}-\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESTAURANT_TABLE_KEY = "restaurant-table";
const DEFAULT_RADIUS_MILES = 5;

type FlowStep = "city" | "category" | "scope" | "places" | "booking";

const validationSchema = {
  persons: (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 1;
  },
  customer_name: (value: string) => value.trim().length > 0,
  customer_phone: (value: string) => PHONE_REGEX.test(value.trim()),
  customer_email: (value: string) => EMAIL_REGEX.test(value.trim()),
};

function formatPhoneMask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  let masked = digits[0];
  if (digits.length > 1) masked += "-(" + digits.slice(1, Math.min(4, digits.length));
  // Add closing parenthesis only after user types the next digit,
  // so backspace near this boundary does not get stuck.
  if (digits.length > 4) masked += ")-" + digits.slice(4, Math.min(7, digits.length));
  if (digits.length > 7) masked += "-" + digits.slice(7, 11);
  return masked;
}

export default function AIBookingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const { messages, runFlow, isLoading } = usePixAI();
  const { data: profile } = useProfile();
  const { data: availableCities = [ALL_CITIES_OPTION] } = useAvailableCities();
  const { data: categories = [] } = useCategories();
  const createCartItem = useCreateCartItem();
  const [currentStep, setCurrentStep] = useState<FlowStep>("city");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");
  const [commentInputHeight, setCommentInputHeight] = useState(88);
  const [scope, setScope] = useState<"nearby" | "city">("city");
  const [requestComment, setRequestComment] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PixAIPlace | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PixAISlot | null>(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [form, setForm] = useState<DraftForm>({
    persons: "2",
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    comment: "",
  });

  const stylesThemed = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.background },
        scroll: { padding: 16, paddingTop: Math.max(12, insets.top), paddingBottom: 130 + insets.bottom, gap: 12 },
        topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        backBtn: {
          width: 36,
          height: 36,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          alignItems: "center",
          justifyContent: "center",
        },
        title: { color: colors.text, fontSize: 24, fontWeight: "800" },
        subtitle: { color: colors.textMuted, marginTop: 2, marginBottom: 10 },
        sectionCard: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 12,
          marginBottom: 10,
          gap: 10,
        },
        stepTitle: { color: colors.text, fontWeight: "700", fontSize: 15 },
        optionChip: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 8,
          marginBottom: 6,
        },
        optionChipSelected: { borderColor: colors.primary, backgroundColor: colors.border },
        optionChipText: { color: colors.text, fontWeight: "600" },
        bubble: {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 12,
          marginBottom: 10,
        },
        bubbleUser: { backgroundColor: colors.primary, borderColor: colors.primary },
        bubbleText: { color: colors.text },
        bubbleUserText: { color: colors.onPrimary },
        label: { color: colors.textMuted, fontSize: 11, marginBottom: 8, textTransform: "uppercase", fontWeight: "700" },
        placeCard: {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          borderRadius: 12,
          padding: 10,
          marginBottom: 8,
        },
        placeCardSelected: { borderColor: colors.primary },
        placeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
        placeThumb: {
          width: 74,
          height: 74,
          borderRadius: 10,
          backgroundColor: colors.border,
        },
        placeTextCol: { flex: 1, minWidth: 0 },
        placeName: { color: colors.text, fontWeight: "700" },
        placeMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
        slotGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        slotChip: {
          minWidth: 76,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingVertical: 8,
          paddingHorizontal: 10,
          backgroundColor: colors.card,
        },
        slotChipBest: { borderColor: colors.primary, backgroundColor: colors.border },
        slotChipSelected: { borderColor: colors.primary, backgroundColor: colors.border },
        slotChipUnavailable: { opacity: 0.45 },
        slotText: { color: colors.text, fontSize: 12, fontWeight: "600" },
        field: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: colors.text,
          backgroundColor: colors.card,
          marginBottom: 8,
        },
        commentField: {
          minHeight: 88,
          textAlignVertical: "top",
        },
        helperText: { color: colors.textMuted, fontSize: 12 },
        footer: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: Math.max(10, insets.bottom),
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
          gap: 8,
        },
        row: { flexDirection: "row", alignItems: "center", gap: 8 },
        secondaryBtn: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 11,
          backgroundColor: colors.card,
        },
        secondaryBtnText: { color: colors.text, fontWeight: "700" },
        draftBtn: {
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 12,
        },
        draftBtnText: { color: colors.onPrimary, fontWeight: "700" },
        summaryText: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
        dropdownTrigger: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 12,
          backgroundColor: colors.background,
        },
        dropdownTriggerText: { color: colors.text, fontWeight: "600", flex: 1, marginRight: 8 },
        dropdownPlaceholder: { color: colors.textMuted, fontWeight: "500" },
        pickerRow: {
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        pickerRowText: { color: colors.text, fontSize: 15 },
        pickerCheck: { color: colors.primary, fontWeight: "700", fontSize: 12 },
      }),
    [colors, insets.bottom, insets.top],
  );

  if (!user) return <AuthScreen />;

  useEffect(() => {
    const city = profile?.city?.trim();
    if (!city) return;
    setSelectedCity(city);
    setCurrentStep((prev) => (prev === "city" ? "category" : prev));
  }, [profile?.city]);

  const latestToolResult = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.toolResult)?.toolResult;

  const placeOptions = latestToolResult?.places ?? [];
  const slotOptions = latestToolResult?.slots ?? [];

  const isRestaurantTable = selectedCategoryId === RESTAURANT_TABLE_KEY;

  const selectedCategoryRow = categories.find((c) => c.id === selectedCategoryId);
  const categoryDropdownLabel = isRestaurantTable
    ? "Restaurant table"
    : selectedCategoryRow
      ? `${selectedCategoryRow.icon ?? ""} ${selectedCategoryRow.name}`.trim()
      : selectedCategoryName || "Select service or table";

  const summaryMessage = [
    `City: ${selectedCity || "Not selected"}`,
    `Request: ${isRestaurantTable ? "Restaurant table" : (selectedCategoryName || "Not selected")}`,
    `Scope: ${scope === "nearby" ? "Near me (5 miles)" : "All places in city"}`,
    selectedPlace ? `Place: ${selectedPlace.name}` : null,
    requestComment.trim() ? `Comment: ${requestComment.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const onRequestNearbyPermission = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert("Location is required", "To search near you, allow fine location permission.");
      return null;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setLocationCoords(coords);
    return coords;
  };

  const onSearchPlaces = async () => {
    if (!selectedCity || selectedCity === ALL_CITIES_OPTION) {
      Alert.alert("Choose city", "Select your city before searching.");
      return;
    }
    if (!selectedCategoryId) {
      Alert.alert("Choose request", "Select a category or restaurant table.");
      return;
    }

    let coords = locationCoords;
    if (scope === "nearby" && !coords) {
      coords = await onRequestNearbyPermission();
      if (!coords) return;
    }

    const payload: PixAIFlowPayload = {
      city: selectedCity.trim(),
      categoryId: isRestaurantTable ? undefined : selectedCategoryId.trim(),
      categoryName: isRestaurantTable ? "Restaurant table" : selectedCategoryName,
      isRestaurantTable,
      comment: requestComment.trim() || undefined,
      mode: scope,
      radiusMiles: DEFAULT_RADIUS_MILES,
      location: scope === "nearby" ? coords ?? undefined : undefined,
      limit: 8,
    };

    await runFlow(payload);
    setHasSearched(true);
    setCurrentStep("places");
  };

  const onSelectPlace = (place: PixAIPlace) => {
    setSelectedPlace(place);
    setCurrentStep("booking");
  };

  const onCreateDraft = async () => {
    if (!selectedPlace || !selectedSlot) {
      Alert.alert("Missing selection", "Choose a place and a slot first.");
      return;
    }
    const persons = Number(form.persons);
    if (!validationSchema.persons(form.persons)) {
      Alert.alert("Invalid persons", "Please enter at least 1 person.");
      return;
    }
    if (!validationSchema.customer_name(form.customer_name)) {
      Alert.alert("Missing details", "Name is required.");
      return;
    }
    if (!validationSchema.customer_phone(form.customer_phone)) {
      Alert.alert("Invalid phone", "Use format X-(XXX)-XXX-XXXX.");
      return;
    }
    if (!validationSchema.customer_email(form.customer_email)) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    try {
      await createCartItem.mutateAsync({
        business_card_id: selectedPlace.id,
        date_time: selectedSlot.dateTimeIso,
        cost: Number(selectedPlace.booking_price ?? 0),
        persons,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        customer_email: form.customer_email.trim(),
        comment: form.comment.trim() || null,
      });
      Alert.alert("Added to cart", "Your AI booking draft is ready for confirmation in Cart.");
      navigateToCartMain(navigation as unknown as NavigationProp<ParamListBase>);
    } catch {
      Alert.alert("Failed", "Could not create booking draft.");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={stylesThemed.root}>
      <ScrollView style={stylesThemed.root} contentContainerStyle={stylesThemed.scroll}>
        <View style={stylesThemed.topRow}>
          <Pressable style={stylesThemed.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={stylesThemed.title}>PixAI Smart Booking</Text>
        </View>
        <Text style={stylesThemed.subtitle}>Describe what you need and PixAI will suggest places and slots.</Text>

        {currentStep === "city" ? (
          <View style={stylesThemed.sectionCard}>
            <Text style={stylesThemed.stepTitle}>Step 1. Choose city</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose city"
              style={stylesThemed.dropdownTrigger}
              onPress={() => setCityPickerVisible(true)}
            >
              <Text
                style={[stylesThemed.dropdownTriggerText, !selectedCity && stylesThemed.dropdownPlaceholder]}
                numberOfLines={1}
              >
                {selectedCity || "Select city"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {currentStep === "category" ? (
          <View style={stylesThemed.sectionCard}>
            <Text style={stylesThemed.stepTitle}>Step 2. Choose service or table</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose service or table"
              style={stylesThemed.dropdownTrigger}
              onPress={() => setCategoryPickerVisible(true)}
            >
              <Text
                style={[
                  stylesThemed.dropdownTriggerText,
                  !selectedCategoryId && stylesThemed.dropdownPlaceholder,
                ]}
                numberOfLines={2}
              >
                {categoryDropdownLabel}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </Pressable>
            <TextInput
              style={[stylesThemed.field, stylesThemed.commentField, { height: commentInputHeight }]}
              multiline
              value={requestComment}
              onContentSizeChange={(event) => setCommentInputHeight(Math.min(180, Math.max(88, event.nativeEvent.contentSize.height + 10)))}
              onChangeText={setRequestComment}
              placeholder="Optional comment (preferences, budget, atmosphere...)"
              placeholderTextColor={colors.textMuted}
            />
            <Pressable style={stylesThemed.draftBtn} onPress={() => setCurrentStep("scope")}>
              <Text style={stylesThemed.draftBtnText}>Continue</Text>
            </Pressable>
          </View>
        ) : null}

        {currentStep === "scope" ? (
          <View style={stylesThemed.sectionCard}>
            <Text style={stylesThemed.stepTitle}>Step 3. Choose search scope</Text>
            <Pressable
              style={[stylesThemed.optionChip, scope === "nearby" && stylesThemed.optionChipSelected]}
              onPress={() => setScope("nearby")}
            >
              <Text style={stylesThemed.optionChipText}>Near me (5 miles)</Text>
            </Pressable>
            <Pressable
              style={[stylesThemed.optionChip, scope === "city" && stylesThemed.optionChipSelected]}
              onPress={() => setScope("city")}
            >
              <Text style={stylesThemed.optionChipText}>All places in my city</Text>
            </Pressable>
            <Text style={stylesThemed.helperText}>
              Nearby search will ask for fine location permission only when you start search.
            </Text>
            <Pressable style={stylesThemed.draftBtn} onPress={() => void onSearchPlaces()}>
              <Text style={stylesThemed.draftBtnText}>{isLoading ? "Searching..." : "Search places"}</Text>
            </Pressable>
          </View>
        ) : null}

        {messages.map((m) => (
          <View key={m.id} style={[stylesThemed.bubble, m.role === "user" && stylesThemed.bubbleUser]}>
            <Text style={m.role === "user" ? stylesThemed.bubbleUserText : stylesThemed.bubbleText}>{m.content}</Text>
          </View>
        ))}

        {(currentStep === "places" || currentStep === "booking") && hasSearched && placeOptions.length > 0 ? (
          <View>
            <Text style={stylesThemed.label}>Step 4. Suggested places</Text>
            {placeOptions.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => onSelectPlace(place)}
                style={[stylesThemed.placeCard, selectedPlace?.id === place.id && stylesThemed.placeCardSelected]}
              >
                <View style={stylesThemed.placeRow}>
                  <SmartImage
                    uri={place.image}
                    recyclingKey={place.id}
                    style={stylesThemed.placeThumb}
                    contentFit="cover"
                  />
                  <View style={stylesThemed.placeTextCol}>
                    <Text style={stylesThemed.placeName} numberOfLines={2}>
                      {place.name}
                    </Text>
                    <Text style={stylesThemed.placeMeta} numberOfLines={2}>
                      {place.city ?? "City not set"} • {place.address ?? "No address"} • {Number(place.rating).toFixed(1)}★
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}

        {currentStep === "booking" && slotOptions.length > 0 ? (
          <View>
            <Text style={stylesThemed.label}>Step 5. Available slots</Text>
            <View style={stylesThemed.slotGrid}>
              {slotOptions.map((slot) => (
                <Pressable
                  disabled={!slot.available}
                  key={slot.dateTimeIso}
                  onPress={() => setSelectedSlot(slot)}
                  style={[
                    stylesThemed.slotChip,
                    slot.isBest && stylesThemed.slotChipBest,
                    selectedSlot?.dateTimeIso === slot.dateTimeIso && stylesThemed.slotChipSelected,
                    !slot.available && stylesThemed.slotChipUnavailable,
                  ]}
                >
                  <Text style={stylesThemed.slotText}>{slot.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {currentStep === "booking" ? (
          <View>
            <Text style={stylesThemed.label}>Booking details</Text>
            <Text style={stylesThemed.summaryText}>{summaryMessage}</Text>
          <TextInput
            style={stylesThemed.field}
            keyboardType="number-pad"
            value={form.persons}
            onChangeText={(persons) => setForm((prev) => ({ ...prev, persons }))}
            placeholder="Persons"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={stylesThemed.field}
            value={form.customer_name}
            onChangeText={(customer_name) => setForm((prev) => ({ ...prev, customer_name }))}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={stylesThemed.field}
            value={form.customer_phone}
            onChangeText={(customer_phone) => setForm((prev) => ({ ...prev, customer_phone: formatPhoneMask(customer_phone) }))}
            keyboardType="number-pad"
            placeholder="X-(XXX)-XXX-XXXX"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={stylesThemed.field}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.customer_email}
            onChangeText={(customer_email) => setForm((prev) => ({ ...prev, customer_email }))}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={stylesThemed.field}
            multiline
            value={form.comment}
            onChangeText={(comment) => setForm((prev) => ({ ...prev, comment }))}
            placeholder="Optional comment"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={stylesThemed.draftBtn} onPress={() => void onCreateDraft()}>
            <Text style={stylesThemed.draftBtnText}>Add booking draft to cart</Text>
          </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <BottomSheetPickerModal
        visible={cityPickerVisible}
        onClose={() => setCityPickerVisible(false)}
        title="Choose city"
      >
        {availableCities
          .filter((city) => city !== ALL_CITIES_OPTION)
          .map((city) => (
            <Pressable
              key={city}
              style={stylesThemed.pickerRow}
              onPress={() => {
                setSelectedCity(city);
                setCityPickerVisible(false);
                setCurrentStep("category");
              }}
            >
              <Text style={stylesThemed.pickerRowText}>{city}</Text>
              {selectedCity === city ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
            </Pressable>
          ))}
      </BottomSheetPickerModal>

      <BottomSheetPickerModal
        visible={categoryPickerVisible}
        onClose={() => setCategoryPickerVisible(false)}
        title="Choose service or table"
      >
        {categories.map((category) => (
          <Pressable
            key={category.id}
            style={stylesThemed.pickerRow}
            onPress={() => {
              setSelectedCategoryId(category.id);
              setSelectedCategoryName(category.name);
              setCategoryPickerVisible(false);
            }}
          >
            <Text style={stylesThemed.pickerRowText}>
              {category.icon} {category.name}
            </Text>
            {selectedCategoryId === category.id ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
          </Pressable>
        ))}
        <Pressable
          style={stylesThemed.pickerRow}
          onPress={() => {
            setSelectedCategoryId(RESTAURANT_TABLE_KEY);
            setSelectedCategoryName("Restaurant table");
            setCategoryPickerVisible(false);
          }}
        >
          <Text style={stylesThemed.pickerRowText}>Restaurant table</Text>
          {isRestaurantTable ? <Text style={stylesThemed.pickerCheck}>Selected</Text> : null}
        </Pressable>
      </BottomSheetPickerModal>

      <View style={stylesThemed.footer}>
        <View style={stylesThemed.row}>
          {currentStep !== "city" ? (
            <Pressable
              style={[stylesThemed.secondaryBtn, { flex: 1 }]}
              onPress={() =>
                setCurrentStep((step) =>
                  step === "booking" ? "places" : step === "places" ? "scope" : step === "scope" ? "category" : "city",
                )
              }
            >
              <Text style={stylesThemed.secondaryBtnText}>Back step</Text>
            </Pressable>
          ) : null}
          {currentStep === "places" ? (
            <Pressable style={[stylesThemed.draftBtn, { flex: 1 }]} onPress={() => setCurrentStep("scope")}>
              <Text style={stylesThemed.draftBtnText}>Refine search</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
