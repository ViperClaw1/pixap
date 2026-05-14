import { Fragment } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ThemeColors } from "@/shared/theme/palettes";
import type { BookingChatMessage } from "../model/types";
import { useSequentialTypewriterReveal } from "../lib/useSequentialTypewriterReveal";
import type { BookingInlineThreadStyles } from "./bookingInlineThreadStyles";

type InlineProps = {
  variant: "inline";
  threadStyles: BookingInlineThreadStyles;
  first: BookingChatMessage;
  second: BookingChatMessage;
};

type PanelProps = {
  variant: "panel";
  colors: ThemeColors;
  first: BookingChatMessage;
  second: BookingChatMessage;
};

type Props = InlineProps | PanelProps;

export function BookingChainedOpeningAssistantPair(props: Props) {
  const { first, second } = props;
  const chainKey = `${first.id}:${second.id}`;
  const { firstVisible, secondVisible, showSecondBubble } = useSequentialTypewriterReveal(
    first.content,
    second.content,
    chainKey,
  );

  if (props.variant === "inline") {
    const ts = props.threadStyles;
    return (
      <Fragment>
        <View style={ts.bubbleWrapPeer}>
          <View style={[ts.bubble, ts.bubblePeer]}>
            <Text style={ts.bubbleTextPeer}>{firstVisible}</Text>
          </View>
        </View>
        {showSecondBubble ? (
          <View style={ts.bubbleWrapPeer}>
            <View style={[ts.bubble, ts.bubblePeer]}>
              <Text style={ts.bubbleTextPeer}>{secondVisible}</Text>
            </View>
          </View>
        ) : null}
      </Fragment>
    );
  }

  const { colors } = props;
  return (
    <Fragment>
      <View style={[panelStyles.wrap, panelStyles.wrapPeer]}>
        <View
          style={[
            panelStyles.bubble,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[panelStyles.bubbleText, { color: colors.text }]}>{firstVisible}</Text>
        </View>
      </View>
      {showSecondBubble ? (
        <View style={[panelStyles.wrap, panelStyles.wrapPeer]}>
          <View
            style={[
              panelStyles.bubble,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[panelStyles.bubbleText, { color: colors.text }]}>{secondVisible}</Text>
          </View>
        </View>
      ) : null}
    </Fragment>
  );
}

const panelStyles = StyleSheet.create({
  wrap: {
    width: "100%",
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  wrapPeer: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
});
