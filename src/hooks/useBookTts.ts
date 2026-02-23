import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ttsService } from '../services/ttsService';

type TtsEngine = 'web-speech' | 'audio-fallback' | 'unsupported';

const DEFAULT_RATE = 1;

export type TtsChunk = {
  id: string;
  text: string;
};

type PersistedTtsState = {
  chunkIndex: number;
  rate: number;
  voiceURI?: string;
};

function splitIntoChunks(text: string, maxChunkLength = 260): TtsChunk[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentenceRegex = /[^.!?]+[.!?]?/g;
  const sentences = normalized.match(sentenceRegex) ?? [normalized];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const next = sentence.trim();
    if (!next) continue;
    if ((current + ' ' + next).trim().length <= maxChunkLength) {
      current = (current + ' ' + next).trim();
      continue;
    }
    if (current) chunks.push(current);
    if (next.length > maxChunkLength) {
      let start = 0;
      while (start < next.length) {
        chunks.push(next.slice(start, start + maxChunkLength));
        start += maxChunkLength;
      }
      current = '';
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);

  return chunks.map((chunk, index) => ({ id: `chunk-${index}`, text: chunk }));
}

function readPersistedState(storageKey: string): PersistedTtsState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedTtsState;
  } catch {
    return null;
  }
}

function savePersistedState(storageKey: string, payload: PersistedTtsState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(payload));
  } catch {
    // no-op
  }
}

export function useBookTts(bookId: string, fullText: string) {
  const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  const canServerFallback = ttsService.canUseServerTts();
  const engine: TtsEngine = speechSupported ? 'web-speech' : canServerFallback ? 'audio-fallback' : 'unsupported';
  const storageKey = `tts-reader:${bookId}`;
  const chunks = useMemo(() => splitIntoChunks(fullText), [fullText]);

  const synthRef = useRef<SpeechSynthesis | null>(speechSupported ? window.speechSynthesis : null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string | undefined>(undefined);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [resumeSuggestion, setResumeSuggestion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedVoice = useMemo(
    () => voices.find((voice) => voice.voiceURI === voiceURI),
    [voices, voiceURI],
  );

  useEffect(() => {
    const saved = readPersistedState(storageKey);
    if (!saved) return;
    const safeChunk = Math.max(0, Math.min(saved.chunkIndex, Math.max(0, chunks.length - 1)));
    if (safeChunk > 0) setResumeSuggestion(safeChunk);
    if (saved.rate) setRate(saved.rate);
    if (saved.voiceURI) setVoiceURI(saved.voiceURI);
  }, [storageKey, chunks.length]);

  useEffect(() => {
    savePersistedState(storageKey, {
      chunkIndex: currentChunkIndex,
      rate,
      voiceURI,
    });
  }, [currentChunkIndex, rate, voiceURI, storageKey]);

  useEffect(() => {
    if (!speechSupported) return;
    const synth = synthRef.current;
    if (!synth) return;

    const loadVoices = () => {
      const loaded = synth.getVoices();
      setVoices(loaded);
      if (!voiceURI && loaded.length > 0) {
        const preferred = loaded.find((voice) => voice.lang.startsWith('en') && /natural|neural|google|samantha|aria/i.test(voice.name))
          ?? loaded.find((voice) => voice.lang.startsWith('en'))
          ?? loaded[0];
        setVoiceURI(preferred?.voiceURI);
      }
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, [speechSupported, voiceURI]);

  const stopWebSpeech = useCallback(() => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.cancel();
    utteranceRef.current = null;
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setAudioCurrentTime(0);
    setAudioDuration(0);
  }, []);

  const stop = useCallback(() => {
    stopWebSpeech();
    stopAudio();
    setIsPlaying(false);
    setIsPaused(false);
    setError(null);
  }, [stopAudio, stopWebSpeech]);

  const speakFromChunk = useCallback((chunkIndex: number) => {
    const synth = synthRef.current;
    if (!synth) return;
    if (chunkIndex < 0 || chunkIndex >= chunks.length) return;

    stopWebSpeech();

    const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex].text);
    utterance.rate = rate;
    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.onend = () => {
      setIsPaused(false);
      if (chunkIndex >= chunks.length - 1) {
        setIsPlaying(false);
        return;
      }
      const next = chunkIndex + 1;
      setCurrentChunkIndex(next);
      speakFromChunk(next);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setError('Unable to play this text via browser TTS.');
    };
    utteranceRef.current = utterance;
    synth.speak(utterance);
  }, [chunks, rate, selectedVoice, stopWebSpeech]);

  const startAudioFallback = useCallback(async () => {
    try {
      setError(null);
      const text = chunks.map((chunk) => chunk.text).join(' ');
      const result = await ttsService.generateAudio({
        text,
        voice: voiceURI,
        rate,
      });

      if (!audioRef.current) {
        const audio = new Audio();
        audioRef.current = audio;
      }

      const audio = audioRef.current;
      audio.src = result.audioUrl;
      audio.playbackRate = rate;
      audio.ontimeupdate = () => setAudioCurrentTime(audio.currentTime);
      audio.onloadedmetadata = () => setAudioDuration(audio.duration || result.durationSec || 0);
      audio.onended = () => {
        setIsPlaying(false);
        setIsPaused(false);
      };
      await audio.play();
    } catch (err) {
      setIsPlaying(false);
      setIsPaused(false);
      setError(err instanceof Error ? err.message : 'Unable to generate fallback audio.');
    }
  }, [chunks, voiceURI, rate]);

  const play = useCallback(async () => {
    if (chunks.length === 0) return;
    setError(null);
    setIsPlaying(true);
    setIsPaused(false);

    if (engine === 'web-speech') {
      const synth = synthRef.current;
      if (synth?.paused) {
        synth.resume();
        return;
      }
      speakFromChunk(currentChunkIndex);
      return;
    }

    if (engine === 'audio-fallback') {
      await startAudioFallback();
      return;
    }

    setIsPlaying(false);
    setError('Text-to-speech is not supported on this device.');
  }, [chunks.length, currentChunkIndex, engine, speakFromChunk, startAudioFallback]);

  const pause = useCallback(() => {
    if (engine === 'web-speech') {
      const synth = synthRef.current;
      if (synth?.speaking) {
        synth.pause();
        setIsPaused(true);
        setIsPlaying(false);
      }
      return;
    }

    if (engine === 'audio-fallback' && audioRef.current) {
      audioRef.current.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [engine]);

  const resume = useCallback(async () => {
    if (engine === 'web-speech') {
      const synth = synthRef.current;
      if (synth?.paused) {
        synth.resume();
        setIsPaused(false);
        setIsPlaying(true);
      } else {
        await play();
      }
      return;
    }

    if (engine === 'audio-fallback' && audioRef.current) {
      await audioRef.current.play();
      setIsPaused(false);
      setIsPlaying(true);
    }
  }, [engine, play]);

  const stepChunk = useCallback((delta: number) => {
    const next = Math.max(0, Math.min(chunks.length - 1, currentChunkIndex + delta));
    setCurrentChunkIndex(next);
    if (engine === 'web-speech' && (isPlaying || isPaused)) {
      setIsPaused(false);
      setIsPlaying(true);
      speakFromChunk(next);
    }
  }, [chunks.length, currentChunkIndex, engine, isPlaying, isPaused, speakFromChunk]);

  const skipAudioSeconds = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || Number.MAX_SAFE_INTEGER, audio.currentTime + delta));
  }, []);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const progress = useMemo(() => {
    if (engine === 'audio-fallback') {
      return audioDuration > 0 ? Math.min(1, audioCurrentTime / audioDuration) : 0;
    }
    if (chunks.length === 0) return 0;
    return (currentChunkIndex + 1) / chunks.length;
  }, [engine, audioCurrentTime, audioDuration, chunks.length, currentChunkIndex]);

  const applyResume = useCallback(() => {
    if (resumeSuggestion === null) return;
    setCurrentChunkIndex(resumeSuggestion);
    setResumeSuggestion(null);
  }, [resumeSuggestion]);

  const dismissResume = useCallback(() => setResumeSuggestion(null), []);

  return {
    engine,
    chunks,
    voices,
    voiceURI,
    setVoiceURI,
    rate,
    setRate,
    selectedVoice,
    isPlaying,
    isPaused,
    currentChunkIndex,
    setCurrentChunkIndex,
    play,
    pause,
    resume,
    stop,
    stepChunk,
    skipAudioSeconds,
    progress,
    audioCurrentTime,
    audioDuration,
    resumeSuggestion,
    applyResume,
    dismissResume,
    error,
  };
}
