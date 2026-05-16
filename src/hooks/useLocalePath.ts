import { useLanguage } from "@/contexts/LanguageContext";

export function useLocalePath() {
  const { language } = useLanguage();
  return (path: string): string => {
    if (language === "en") {
      return path === "/" ? "/en" : `/en${path}`;
    }
    return path;
  };
}
