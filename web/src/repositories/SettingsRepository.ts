export class SettingsRepository {
  private static readonly API_KEY_KEY = 'gemini_api_key';

  static getApiKey(): string | null {
    return localStorage.getItem(this.API_KEY_KEY);
  }

  static setApiKey(key: string): void {
    if (key.trim() === '') {
      localStorage.removeItem(this.API_KEY_KEY);
    } else {
      localStorage.setItem(this.API_KEY_KEY, key.trim());
    }
  }
}
