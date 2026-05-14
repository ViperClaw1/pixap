import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { ThemeColors } from "@/shared/theme/palettes";
import { SmartImage } from "@/shared/ui/smart-image/SmartImage";
import { detectAttachmentKind } from "../lib/detectAttachmentKind";
import { shareAttachmentUri } from "../api/shareAttachmentUri";
import type { AttachmentKind } from "../model/types";
import { AttachmentVideoView } from "./AttachmentVideoView";

type Props = {
  visible: boolean;
  uri: string | null;
  mimeHint?: string | null;
  displayName?: string | null;
  colors: ThemeColors;
  onClose: () => void;
};

export function AttachmentViewerModal({ visible, uri, mimeHint, displayName, colors, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<AttachmentKind>("image");
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (visible && uri) {
      setKind(detectAttachmentKind(uri, mimeHint));
    }
  }, [visible, uri, mimeHint]);

  const onShare = useCallback(async () => {
    if (!uri) return;
    setSharing(true);
    try {
      await shareAttachmentUri(uri, displayName ?? undefined);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not share file";
      Alert.alert("Share failed", msg);
    } finally {
      setSharing(false);
    }
  }, [uri, displayName]);

  if (!uri) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: "rgba(0,0,0,0.94)" }]}>
        <View style={[styles.toolbar, { paddingTop: Math.max(12, insets.top + 6), paddingRight: Math.max(12, insets.right) }]}>
          <View style={styles.toolbarSpacer} />
          <View style={styles.toolbarActions}>
            <Pressable
              accessibilityLabel="Share or download"
              onPress={() => void onShare()}
              disabled={sharing}
              style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.12)" }]}
            >
              {sharing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="download-outline" size={22} color="#fff" />
              )}
            </Pressable>
            <Pressable
              accessibilityLabel="Close"
              onPress={onClose}
              style={[styles.iconBtn, { borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.12)" }]}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {kind === "image" ? (
            <SmartImage uri={uri} style={styles.fullMedia} contentFit="contain" />
          ) : null}

          {kind === "video" && visible && uri ? <AttachmentVideoView uri={uri} style={styles.fullMedia} /> : null}

          {kind === "file" ? (
            <View style={styles.fileBlock}>
              <Ionicons name="document-attach-outline" size={56} color="rgba(255,255,255,0.85)" />
              <Text style={styles.fileTitle} numberOfLines={2}>
                {displayName?.trim() || "Attachment"}
              </Text>
              <Text style={styles.fileHint}>Use the download button to save or share this file.</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  toolbarSpacer: { flex: 1 },
  toolbarActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    justifyContent: "center",
    alignItems: "stretch",
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  fullMedia: {
    width: "100%",
    flex: 1,
    minHeight: 200,
  },
  fileBlock: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  fileTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  fileHint: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    textAlign: "center",
  },
});
