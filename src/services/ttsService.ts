type TtsAudioResponse = {
  audioUrl: string;
  durationSec?: number;
};

export type GenerateAudioInput = {
  text: string;
  voice?: string;
  rate?: number;
};

class TtsService {
  private endpoint = import.meta.env.VITE_TTS_ENDPOINT as string | undefined;

  canUseServerTts() {
    return typeof this.endpoint === 'string' && this.endpoint.trim().length > 0;
  }

  async generateAudio(payload: GenerateAudioInput): Promise<TtsAudioResponse> {
    if (!this.canUseServerTts()) {
      throw new Error('No server TTS endpoint configured.');
    }

    const response = await fetch(this.endpoint as string, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`TTS endpoint failed (${response.status}).`);
    }

    const json = (await response.json()) as Partial<TtsAudioResponse>;
    if (!json.audioUrl) {
      throw new Error('TTS endpoint did not return audioUrl.');
    }
    return {
      audioUrl: json.audioUrl,
      durationSec: typeof json.durationSec === 'number' ? json.durationSec : undefined,
    };
  }
}

export const ttsService = new TtsService();
