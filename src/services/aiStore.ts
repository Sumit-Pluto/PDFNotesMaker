// ─── AI Settings Store ──────────────────────────────────────────────────────────
//  Persists the user's chosen provider + API key + model in localStorage.
//  BYOK: the key lives only in this browser and is sent only to the chosen
//  provider's API. Nothing is uploaded to any server we control.

import type { ProviderId } from './aiProviders';

export interface AiSettings {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = 'pdf_notes_ai_settings';

export function loadAiSettings(): AiSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    if (parsed.provider && parsed.apiKey && parsed.model) {
      return { provider: parsed.provider, apiKey: parsed.apiKey, model: parsed.model };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveAiSettings(settings: AiSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function clearAiSettings(): void {
  localStorage.removeItem(STORAGE_KEY);
}
