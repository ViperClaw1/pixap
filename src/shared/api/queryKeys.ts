/** Central TanStack Query keys — use for useQuery + invalidateQueries to avoid drift. */

export const STORIES_ROOT = "stories" as const;

/** @deprecated Prefer `STORIES_ROOT` from this module; kept for story entity imports. */
export const STORIES_QUERY_KEY = STORIES_ROOT;

export const USER_FOLLOWS_QUERY_KEY = "user_follows" as const;

export const queryKeys = {
  posts: {
    feed: (userId: string | null, followingSignature: string) =>
      ["posts", "feed", userId, followingSignature] as const,
    /** Prefix: all post feeds for any user / following combo */
    feedPrefix: ["posts", "feed"] as const,
    byId: (postId: string, viewerUserId: string | null) =>
      ["posts", "byId", postId, viewerUserId] as const,
    place: (placeId: string) => ["posts", "place", placeId] as const,
    comments: (postId: string) => ["post_comments", "post", postId] as const,
    reactions: (postId: string) => ["post_reactions", "post", postId] as const,
  },
  stories: {
    strip: ["stories", "strip"] as const,
    feed: (userId: string | null, followingSignature: string) =>
      ["stories", "feed", userId, followingSignature] as const,
    feedPrefix: ["stories", "feed"] as const,
    place: (placeId: string, viewerUserId: string | null) =>
      [STORIES_ROOT, "place", placeId, viewerUserId] as const,
    placePrefix: (placeId: string) => [STORIES_ROOT, "place", placeId] as const,
    comments: (storyId: string) => ["story_comments", "story", storyId] as const,
    commentsQuery: (storyId: string, viewerUserId: string | null | undefined) =>
      ["story_comments", "story", storyId, viewerUserId ?? null] as const,
    /** All per-story comment threads (narrower than `["story_comments"]`). */
    commentsStoryPrefix: ["story_comments", "story"] as const,
    reactions: (storyId: string) => ["story_reactions", "story", storyId] as const,
  },
  cart: {
    items: (userId: string | undefined | null) => ["cart_items", userId ?? null] as const,
    itemsPrefix: ["cart_items"] as const,
    paidItems: (userId: string | undefined | null) => ["paid_cart_items", userId ?? null] as const,
    paidItemsPrefix: ["paid_cart_items"] as const,
  },
  shopping: {
    cart: (userId: string | undefined | null) => ["shopping_cart", userId ?? null] as const,
    cartPrefix: ["shopping_cart"] as const,
    paidCartItems: (userId: string | undefined | null) =>
      ["paid_shopping_cart_items", userId ?? null] as const,
    paidCartItemsPrefix: ["paid_shopping_cart_items"] as const,
  },
  profile: {
    user: (userId: string | undefined | null) => ["profile", userId ?? null] as const,
    phone: (userId: string | undefined | null) => ["profile", "phone", userId ?? null] as const,
    root: ["profile"] as const,
    socialMetrics: (userId: string | null) => ["profile", "social-metrics", userId] as const,
    suggestionsPrefix: ["profile", "suggestions"] as const,
    suggestions: (userId: string | null, limit: number, followingSig: string, bio: string) =>
      ["profile", "suggestions", userId, limit, followingSig, bio] as const,
  },
  publicProfiles: {
    search: (q: string, accountRole: "all" | "user" = "all") => ["public_profiles", "search", q, accountRole] as const,
    root: ["public_profiles"] as const,
  },
  messages: {
    inbox: (userId: string | null) => ["messages", "inbox", userId] as const,
    inboxPrefix: ["messages", "inbox"] as const,
    thread: (threadId: string, userId: string | null) => ["messages", "thread", threadId, userId] as const,
    threadPrefix: (threadId: string) => ["messages", "thread", threadId] as const,
    followSuggestions: (userId: string | null, searchNorm: string) =>
      ["messages", "follow-suggestions", userId, searchNorm] as const,
  },
  notifications: {
    list: (userId: string | undefined | null) => ["notifications", userId ?? null] as const,
    unread: (userId: string | undefined | null) => ["notifications", "unread_count", userId ?? null] as const,
    listPrefix: ["notifications"] as const,
    unreadPrefix: ["notifications", "unread_count"] as const,
  },
  bookings: {
    user: (userId: string | undefined | null) => ["bookings", userId ?? null] as const,
    prefix: ["bookings"] as const,
  },
  favorites: {
    user: (userId: string | undefined | null) => ["favorites", userId ?? null] as const,
    prefix: ["favorites"] as const,
  },
  subscription: {
    entitlement: (userId: string | undefined | null) =>
      ["subscription-entitlement", userId ?? null] as const,
    products: (productIdsJoined: string, iapReady: boolean) =>
      ["subscription-products", productIdsJoined, iapReady] as const,
  },
  businessCards: {
    list: (type: string | undefined, city: string | null) =>
      ["business_cards", type ?? null, city ?? null] as const,
    availableCities: ["business_cards", "available_cities"] as const,
    byId: (id: string) => ["business_card", id] as const,
    byCategory: (categoryId: string) => ["business_cards", "category", categoryId] as const,
    listPrefix: ["business_cards"] as const,
    singlePrefix: ["business_card"] as const,
  },
  availableSlots: (businessCardId: string | null, dateYmd: string | null) =>
    ["available_slots", businessCardId, dateYmd] as const,
  shoppingItems: {
    main: (businessCardId: string) => ["shopping_items", businessCardId, "main"] as const,
    additional: (businessCardId: string) => ["shopping_items", businessCardId, "additional"] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
  reviews: {
    byBusinessCard: (businessCardId: string) => ["reviews", businessCardId] as const,
  },
  userRole: {
    byUser: (userId: string | undefined | null) => ["user-role", userId ?? null] as const,
  },
  userFollows: {
    mine: (userId: string | null) => [USER_FOLLOWS_QUERY_KEY, "mine", userId] as const,
    prefix: [USER_FOLLOWS_QUERY_KEY] as const,
  },
} as const;
