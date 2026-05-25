import { memo, useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { useDeleteCartItem, isWaOwnerUnreachableLines, parseWaStatusLines, type CartItem } from "@/entities/cart";
import { getPrimaryBusinessCardImage } from "@/shared/lib/business-card/businessCardImages";
import { isAuthRequiredError } from "@/shared/lib/auth/authRequired";
import type { CartScreenStyles } from "./cartStyles";

type Props = {
  item: CartItem;
  stylesThemed: CartScreenStyles;
  onConfirmBooking: (item: CartItem) => Promise<void>;
  onPayBooking: (item: CartItem) => Promise<void>;
  onAuthRequired: () => void;
};

function ServiceCartRowInner({ item, stylesThemed, onConfirmBooking, onPayBooking, onAuthRequired }: Props) {
  const deleteCartItem = useDeleteCartItem();
  const [confirming, setConfirming] = useState(false);
  const statusLines = parseWaStatusLines(item.wa_status_lines);
  const ownerUnreachable = isWaOwnerUnreachableLines(statusLines);
  const canConfirm = Boolean(item.wa_confirmable) && !ownerUnreachable;
  const paymentLink = item.wa_payment_link?.trim() || null;
  const canPay = canConfirm && Boolean(paymentLink);
  const hasVenueWa = Boolean(item.business_card?.contact_whatsapp?.trim());

  const onRemoveServiceItem = async () => {
    try {
      await deleteCartItem.mutateAsync(item.id);
    } catch (error) {
      if (isAuthRequiredError(error)) {
        onAuthRequired();
        return;
      }
      Alert.alert("Failed", "Could not remove this item from your cart.");
    }
  };

  return (
    <View style={stylesThemed.card}>
      <SmartImage
        uri={getPrimaryBusinessCardImage(item.business_card?.images)}
        recyclingKey={`svc-${item.id}`}
        style={stylesThemed.thumb}
        contentFit="cover"
      />
      <View style={{ flex: 1 }}>
        <Text style={stylesThemed.name}>{item.business_card?.name}</Text>
        <Text style={stylesThemed.meta}>{new Date(item.date_time).toLocaleString()}</Text>
        {item.persons ? <Text style={stylesThemed.meta}>Persons: {item.persons}</Text> : null}
        {item.customer_name ? <Text style={stylesThemed.meta}>Name: {item.customer_name}</Text> : null}
        {item.customer_phone ? <Text style={stylesThemed.meta}>Phone: {item.customer_phone}</Text> : null}
        {item.customer_email ? <Text style={stylesThemed.meta}>Email: {item.customer_email}</Text> : null}
        {item.comment ? <Text style={stylesThemed.meta}>Comment: {item.comment}</Text> : null}
        <Text style={stylesThemed.price}>{Number(item.cost).toLocaleString()} </Text>
        {!hasVenueWa ? (
          <Text style={[stylesThemed.meta, { marginTop: 8 }]}>Venue has no WhatsApp on file — automation cannot start.</Text>
        ) : null}
        {statusLines.length > 0 ? (
          <View style={{ marginTop: 10, gap: 4 }}>
            {statusLines.map((line, idx) => (
              <Text
                key={`${idx}-${line.slice(0, 24)}`}
                style={[stylesThemed.waStatusLine, ownerUnreachable && { color: "#c45c26" }]}
              >
                {line}
              </Text>
            ))}
          </View>
        ) : item.wa_n8n_started_at ? (
          <Text style={[stylesThemed.meta, { marginTop: 8 }]}>Waiting for venue status…</Text>
        ) : hasVenueWa ? (
          <Text style={[stylesThemed.meta, { marginTop: 8 }]}>Starting venue check…</Text>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {canPay ? (
            <Pressable
              style={[stylesThemed.smallBtnOutline, confirming && { opacity: 0.55 }]}
              disabled={confirming}
              accessibilityState={{ disabled: confirming }}
              onPress={() => {
                setConfirming(true);
                void Promise.resolve(onPayBooking(item)).finally(() => setConfirming(false));
              }}
            >
              <Text style={stylesThemed.smallBtnOutlineText}>{confirming ? "Opening…" : "Pay"}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[stylesThemed.smallBtnOutline, (confirming || !canConfirm) && { opacity: 0.55 }]}
            disabled={confirming || !canConfirm}
            accessibilityState={{ disabled: confirming || !canConfirm }}
            onPress={() => {
              setConfirming(true);
              void Promise.resolve(onConfirmBooking(item)).finally(() => setConfirming(false));
            }}
          >
            <Text style={stylesThemed.smallBtnOutlineText}>{confirming ? "Saving…" : "Confirm"}</Text>
          </Pressable>
          <Pressable style={stylesThemed.smallBtnDanger} onPress={() => void onRemoveServiceItem()}>
            <Text style={stylesThemed.dangerBtnText}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export const ServiceCartRow = memo(ServiceCartRowInner);
