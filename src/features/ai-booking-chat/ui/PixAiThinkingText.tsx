import { useEffect, useState } from "react";
import { Text, type TextStyle } from "react-native";
import { useTranslation } from "react-i18next";

const ELLIPSIS = [".", "..", "..."] as const;
const ELLIPSIS_TICK_MS = 1000;

type Props = {
  style?: TextStyle;
};

export function PixAiThinkingText({ style }: Props) {
  const { t } = useTranslation();
  const [ellipsisIndex, setEllipsisIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setEllipsisIndex((prev) => (prev + 1) % ELLIPSIS.length);
    }, ELLIPSIS_TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Text style={style}>
      {t("aiBooking.pixAiThinking")}
      {ELLIPSIS[ellipsisIndex]}
    </Text>
  );
}
