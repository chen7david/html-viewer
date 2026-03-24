export interface AiProviderSettings {
  activeProvider: 'gemini' | 'openwebui';
  geminiApiKey: string;
  openWebUiEndpoint: string;
  openWebUiApiKey: string;
  openWebUiModelId: string;
}

export class SettingsRepository {
  private static readonly AI_SETTINGS_KEY = 'ai_provider_settings';

  static getAiSettings(): AiProviderSettings {
    const raw = localStorage.getItem(this.AI_SETTINGS_KEY);
    const legacyGeminiKey = localStorage.getItem('gemini_api_key'); // Backward compat
    
    const defaults: AiProviderSettings = {
      activeProvider: 'gemini',
      geminiApiKey: legacyGeminiKey || '',
      openWebUiEndpoint: 'https://proxy.your-cloudflare-domain.com/v1/chat/completions',
      openWebUiApiKey: '',
      openWebUiModelId: 'glm-4.7-flash:latest',
    };

    if (raw) {
      try { 
        const parsed = JSON.parse(raw); 
        return { ...defaults, ...parsed }; // Safely merge defaults so new fields never crash
      } catch (e) {}
    }

    return defaults;
  }

  static saveAiSettings(settings: AiProviderSettings): void {
    localStorage.setItem(this.AI_SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem('gemini_api_key', settings.geminiApiKey); // Sync legacy
  }

  static getApiKey(): string | null {
    return this.getAiSettings().geminiApiKey || null;
  }
}
