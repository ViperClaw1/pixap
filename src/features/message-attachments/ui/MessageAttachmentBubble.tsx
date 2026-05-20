import { memo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { isStickerAssetUri } from "@/shared/constants/commentStickers";
import { detectAttachmentKind } from "../lib/detectAttachmentKind";
import {
  getMessageAttachmentImageDisplayUri,
  type MessageAttachmentImageLayout,
} from "../lib/messageAttachmentDisplayUrl";
import { MessageVideoThumbnail } from "./MessageVideoThumbnail";

type Props = {
  uri: string;
  boxStyle: StyleProp<ViewStyle>;
  placeholderStyle: StyleProp<ViewStyle>;
  iconColor: string;
  imageLayout?: MessageAttachmentImageLayout;
};

export const MessageAttachmentBubble = memo(function MessageAttachmentBubble({
  uri,
  boxStyle,
  placeholderStyle,
  iconColor,
  imageLayout = "thumb",
}: Props) {
  const sticker = isStickerAssetUri(uri);
  if (sticker) {
    return <SmartImage uri={uri} style={boxStyle} contentFit="cover" recyclingKey={uri} />;
  }

  const kind = detectAttachmentKind(uri, null);
  if (kind === "image") {
    const displayUri = getMessageAttachmentImageDisplayUri(uri, imageLayout);
    return (
      <SmartImage
        uri={displayUri}
        fallbackUri={displayUri !== uri ? uri : undefined}
        style={boxStyle}
        contentFit="cover"
        recyclingKey={displayUri}
      />
    );
  }

  if (kind === "video") {
    return <MessageVideoThumbnail videoUri={uri} style={boxStyle} iconColor={iconColor} />;
  }

  return (
    <View style={[boxStyle, placeholderStyle]}>
      <Ionicons name="document-text-outline" size={28} color={iconColor} />
    </View>
  );
});
