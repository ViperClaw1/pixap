import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image, type ImageSource } from "expo-image";

const LOADING_SPINNER_COLOR = "#FF7043";
const IMAGE_FADE_MS = 220;
const SPINNER_DELAY_MS = 120;

type Props = {
  source: ImageSource;
  recyclingKey: string;
};

function isBundledAsset(source: ImageSource): boolean {
  return typeof source === "number";
}

export const PaywallTourSlideImage = memo(function PaywallTourSlideImage({ source, recyclingKey }: Props) {
  const bundledAsset = isBundledAsset(source);
  const [showSpinner, setShowSpinner] = useState(false);
  const loadingRef = useRef(!bundledAsset);
  const spinnerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSpinner = useCallback(() => {
    loadingRef.current = false;
    setShowSpinner(false);
    if (spinnerTimerRef.current) {
      clearTimeout(spinnerTimerRef.current);
      spinnerTimerRef.current = null;
    }
  }, []);

  const scheduleSpinner = useCallback(() => {
    if (bundledAsset) return;

    if (spinnerTimerRef.current) {
      clearTimeout(spinnerTimerRef.current);
    }
    setShowSpinner(false);
    spinnerTimerRef.current = setTimeout(() => {
      if (loadingRef.current) {
        setShowSpinner(true);
      }
    }, SPINNER_DELAY_MS);
  }, [bundledAsset]);

  useEffect(() => {
    if (bundledAsset) {
      clearSpinner();
      return;
    }

    loadingRef.current = true;
    scheduleSpinner();
    return () => {
      if (spinnerTimerRef.current) {
        clearTimeout(spinnerTimerRef.current);
      }
    };
  }, [bundledAsset, clearSpinner, recyclingKey, scheduleSpinner]);

  const handleLoadStart = useCallback(() => {
    if (bundledAsset) return;
    loadingRef.current = true;
    scheduleSpinner();
  }, [bundledAsset, scheduleSpinner]);

  const handleLoadEnd = useCallback(() => {
    clearSpinner();
  }, [clearSpinner]);

  return (
    <View style={styles.host}>
      <Image
        source={source}
        recyclingKey={recyclingKey}
        style={styles.image}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={IMAGE_FADE_MS}
        onLoadStart={bundledAsset ? undefined : handleLoadStart}
        onLoad={handleLoadEnd}
        onDisplay={handleLoadEnd}
        onError={handleLoadEnd}
      />
      {showSpinner ? (
        <View style={styles.spinnerHost} pointerEvents="none">
          <ActivityIndicator size="large" color={LOADING_SPINNER_COLOR} />
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  host: {
    flex: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  spinnerHost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    zIndex: 2,
  },
});
