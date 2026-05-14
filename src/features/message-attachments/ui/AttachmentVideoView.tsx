import { type StyleProp, type ViewStyle } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";

type Props = {
  uri: string;
  style?: StyleProp<ViewStyle>;
};

/** Isolated so `useVideoPlayer` runs only when this subtree mounts (video attachments). */
export function AttachmentVideoView({ uri, style }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });

  return <VideoView style={style} player={player} nativeControls contentFit="contain" />;
}
