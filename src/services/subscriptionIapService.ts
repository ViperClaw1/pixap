import { Platform } from "react-native";
import {
  type ProductSubscription,
  type Purchase,
  type PurchaseError,
  clearTransactionIOS,
  fetchProducts,
  endConnection,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
} from "react-native-iap";

export type PurchasePlatform = "ios" | "android";

export type SubscriptionPurchase = Purchase;

export type PurchasePayload = {
  platform: PurchasePlatform;
  productId?: string;
  transactionId?: string;
  originalTransactionId?: string;
  transactionReceipt?: string;
  purchaseToken?: string;
  purchase: Record<string, unknown>;
};

export type RestoredPurchase = {
  payload: PurchasePayload;
  raw: SubscriptionPurchase;
};

function getPlatform(): PurchasePlatform {
  return Platform.OS === "ios" ? "ios" : "android";
}

function normalizePurchase(purchase: SubscriptionPurchase): PurchasePayload {
  return {
    platform: getPlatform(),
    productId: purchase.productId,
    transactionId: purchase.transactionId ?? undefined,
    originalTransactionId: "originalTransactionIdentifierIOS" in purchase
      ? purchase.originalTransactionIdentifierIOS ?? undefined
      : undefined,
    transactionReceipt: undefined,
    purchaseToken: purchase.purchaseToken ?? undefined,
    purchase: purchase as unknown as Record<string, unknown>,
  };
}

function resolveAndroidOfferToken(product: ProductSubscription | undefined): string | null {
  if (!product || product.platform !== "android") return null;

  const standardizedOffers = product.subscriptionOffers ?? [];
  const firstStandardized = standardizedOffers.find((offer) => typeof offer.offerTokenAndroid === "string");
  if (firstStandardized?.offerTokenAndroid) return firstStandardized.offerTokenAndroid;

  const legacyOffers = product.subscriptionOfferDetailsAndroid ?? [];
  const firstLegacy = legacyOffers.find((offer) => typeof offer.offerToken === "string");
  if (firstLegacy?.offerToken) return firstLegacy.offerToken;

  return null;
}

export async function initIapConnection(): Promise<void> {
  await initConnection();
  if (Platform.OS === "ios") await clearTransactionIOS().catch(() => undefined);
}

export async function endIapConnection(): Promise<void> {
  await endConnection();
}

export async function fetchSubscriptionProducts(skus: string[]): Promise<ProductSubscription[]> {
  if (skus.length === 0) return [];
  const products = await fetchProducts({ skus, type: "subs" });
  return (products ?? []) as ProductSubscription[];
}

export async function startSubscriptionPurchase(productId: string, products: ProductSubscription[] = []): Promise<void> {
  const selectedProduct = products.find((product) => product.id === productId);
  const androidOfferToken = resolveAndroidOfferToken(selectedProduct);
  if (Platform.OS === "android" && !androidOfferToken) {
    throw new Error("No eligible Play subscription offer is available for this account.");
  }

  const request =
    Platform.OS === "android"
      ? {
          google: {
            skus: [productId],
            subscriptionOffers: [{ sku: productId, offerToken: androidOfferToken! }],
          },
        }
      : {
          apple: { sku: productId },
        };

  await requestPurchase({
    type: "subs",
    request,
  });
}

export async function restorePurchases(): Promise<RestoredPurchase[]> {
  const purchases = await getAvailablePurchases({ onlyIncludeActiveItemsIOS: false });
  return purchases.map((purchase) => ({
    payload: normalizePurchase(purchase),
    raw: purchase,
  }));
}

export function startPurchaseListeners(options: {
  onPurchase: (purchase: PurchasePayload, raw: SubscriptionPurchase) => Promise<void> | void;
  onError?: (error: PurchaseError) => void;
}): () => void {
  const purchaseSub = purchaseUpdatedListener(async (purchase) => {
    await options.onPurchase(normalizePurchase(purchase), purchase);
  });
  const errorSub = purchaseErrorListener((error) => {
    options.onError?.(error);
  });

  return () => {
    purchaseSub.remove();
    errorSub.remove();
  };
}

export async function acknowledgePurchase(rawPurchase: SubscriptionPurchase): Promise<void> {
  await finishTransaction({ purchase: rawPurchase, isConsumable: false });
}
