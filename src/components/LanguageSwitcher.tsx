import { Languages } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface Language {
  code: string;
  name: string;
  flag: string;
}

const languages: Language[] = [
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
];

interface LanguageSwitcherProps {
  onLanguageChange?: (languageCode: string) => void;
  defaultLanguage?: string;
}

export default function LanguageSwitcher({
  onLanguageChange,
  defaultLanguage,
}: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  const handleLanguageSelect = (languageCode: string) => {
    setLanguage(languageCode as any);
    onLanguageChange?.(languageCode);
  };

  const currentLanguage =
    languages.find((lang) => lang.code === language) || languages[0];

  return (
    <div className="bg-white">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Languages className="w-4 h-4" />
            <span className="hidden sm:inline">{currentLanguage.flag}</span>
            <span className="hidden md:inline">{currentLanguage.name}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageSelect(lang.code)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{lang.flag}</span>
                <span>{lang.name}</span>
              </div>
              {language === lang.code && (
                <Badge variant="secondary" className="ml-2">
                  Activo
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
