export type WasteStreamId = "wet" | "dry" | "sanitary" | "special_care";
type LocalisedText = { en: string; kn: string };
type LocalisedList = { en: string[]; kn: string[] };

export interface WasteStreamGuide {
  id: WasteStreamId;
  label: LocalisedText;
  container: LocalisedText;
  examples: LocalisedList;
  exceptions: LocalisedText;
  keywords: string[];
}

export const wasteStreams: WasteStreamGuide[] = [
  {
    id: "wet",
    label: { en: "Wet waste", kn: "ಹಸಿ ತ್ಯಾಜ್ಯ" },
    container: { en: "Green container", kn: "ಹಸಿರು ಪಾತ್ರೆ" },
    examples: { en: ["food scraps", "vegetable peels", "garden waste"], kn: ["ಆಹಾರ ಉಳಿಕೆ", "ತರಕಾರಿ ಸಿಪ್ಪೆ", "ತೋಟದ ತ್ಯಾಜ್ಯ"] },
    exceptions: { en: "Drain liquids; never mix diapers, glass or batteries.", kn: "ದ್ರವವನ್ನು ಹೊರಹಾಕಿ; ಡೈಪರ್, ಗಾಜು ಅಥವಾ ಬ್ಯಾಟರಿಗಳನ್ನು ಬೆರೆಸಬೇಡಿ." },
    keywords: ["food", "vegetable", "peel", "garden", "flower", "leaf"],
  },
  {
    id: "dry",
    label: { en: "Dry waste", kn: "ಒಣ ತ್ಯಾಜ್ಯ" },
    container: { en: "Blue container or clean bag", kn: "ನೀಲಿ ಪಾತ್ರೆ ಅಥವಾ ಸ್ವಚ್ಛ ಚೀಲ" },
    examples: { en: ["paper", "cardboard", "clean plastic"], kn: ["ಕಾಗದ", "ರಟ್ಟಿನ ಪೆಟ್ಟಿಗೆ", "ಸ್ವಚ್ಛ ಪ್ಲಾಸ್ಟಿಕ್"] },
    exceptions: { en: "Keep clean and dry; hand broken glass separately to the collector.", kn: "ಸ್ವಚ್ಛವಾಗಿ ಮತ್ತು ಒಣಗಿಸಿ; ಒಡೆದ ಗಾಜನ್ನು ಪ್ರತ್ಯೇಕವಾಗಿ ಸಂಗ್ರಾಹಕರಿಗೆ ನೀಡಿ." },
    keywords: ["paper", "cardboard", "box", "plastic", "metal", "glass"],
  },
  {
    id: "sanitary",
    label: { en: "Sanitary waste", kn: "ಸ್ಯಾನಿಟರಿ ತ್ಯಾಜ್ಯ" },
    container: { en: "Securely wrapped and clearly marked", kn: "ಭದ್ರವಾಗಿ ಸುತ್ತಿ ಸ್ಪಷ್ಟವಾಗಿ ಗುರುತಿಸಿ" },
    examples: { en: ["used diapers", "sanitary pads", "bandages"], kn: ["ಬಳಸಿದ ಡೈಪರ್", "ಸ್ಯಾನಿಟರಿ ಪ್ಯಾಡ್", "ಬ್ಯಾಂಡೇಜ್"] },
    exceptions: { en: "Wrap safely; do not place loose items in wet or dry waste.", kn: "ಸುರಕ್ಷಿತವಾಗಿ ಸುತ್ತಿ; ಹಸಿ ಅಥವಾ ಒಣ ತ್ಯಾಜ್ಯದಲ್ಲಿ ಬಿಡಿಯಾಗಿ ಹಾಕಬೇಡಿ." },
    keywords: ["diaper", "sanitary", "pad", "bandage", "medical dressing"],
  },
  {
    id: "special_care",
    label: { en: "Special-care waste", kn: "ವಿಶೇಷ ಆರೈಕೆ ತ್ಯಾಜ್ಯ" },
    container: { en: "Store safely for authorised collection", kn: "ಅಧಿಕೃತ ಸಂಗ್ರಹಕ್ಕಾಗಿ ಸುರಕ್ಷಿತವಾಗಿ ಇಡಿ" },
    examples: { en: ["batteries", "bulbs", "paint or chemical containers"], kn: ["ಬ್ಯಾಟರಿ", "ಬಲ್ಬ್", "ಬಣ್ಣ ಅಥವಾ ರಾಸಾಯನಿಕ ಪಾತ್ರೆ"] },
    exceptions: { en: "Never mix, puncture or burn; use the announced special collection channel.", kn: "ಬೆರೆಸಬೇಡಿ, ಚುಚ್ಚಬೇಡಿ ಅಥವಾ ಸುಡಬೇಡಿ; ಘೋಷಿತ ವಿಶೇಷ ಸಂಗ್ರಹ ಮಾರ್ಗ ಬಳಸಿ." },
    keywords: ["battery", "bulb", "paint", "chemical", "e-waste", "electronic"],
  },
];

export function wasteStreamForItem(item: string) {
  const normalised = item.trim().toLowerCase();
  return wasteStreams.find((stream) => stream.keywords.some((keyword) => normalised.includes(keyword)));
}
