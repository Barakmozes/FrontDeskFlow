"use client";

/**
 * app/components/Common/TranslateToggle.tsx
 *
 * This client component:
 * - Detects the current locale (from the server or default)
 * - Provides a button to toggle "English <-> Hebrew"
 * - Programmatically calls the hidden Google Translate <select> to do the actual translation.
 * - Persists the user's choice in a 'locale' cookie for SSR orientation/SEO hints on refresh.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TranslateToggleProps {
  currentLocale: string; // "en" or "he"
}

export default function TranslateToggle({ currentLocale }: TranslateToggleProps) {
  const router = useRouter();
  const [locale, setLocale] = useState(currentLocale);

  // Force Google Translate to switch languages by selecting the hidden dropdown
  function doGTranslate(langPair: string) {
    // e.g. "en|he" or "en|en"
    const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");

    if (!combo) {
      // The Google Translate script may not have initialized yet.
      setTimeout(() => doGTranslate(langPair), 500);
      return;
    }

    // Extract the target language (the part after '|')
    const lang = langPair.split("|")[1];
    combo.value = lang;
    // Trigger a change event to start translation
    combo.dispatchEvent(new Event("change"));
  }

  const handleToggle = () => {
    // If we're currently English, translate to Hebrew
    // If currently Hebrew, revert to English
    const nextLangPair = locale === "en" ? "en|he" : "en|en";

    // Start in-page translation
    doGTranslate(nextLangPair);

    // Update cookie for SSR orientation on subsequent requests
    const newLocale = locale === "en" ? "he" : "en";

    // Add SameSite=Lax to avoid some cross-site warnings (good practice for 1st-party cookies)
    document.cookie = `locale=${newLocale};path=/;SameSite=Lax;`;

    setLocale(newLocale);

    // Refresh the page to ensure SSR picks up new locale for <html lang/dir>, if desired
    // Remove if you want purely client-side updates without a page reload
    router.refresh();
  };

  return (
    <div className="p-4">
      <button
        onClick={handleToggle}
        className="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
      >
        {locale === "en" ? "Switch to Hebrew" : "Switch to English"}
      </button>
    </div>
  );
}
