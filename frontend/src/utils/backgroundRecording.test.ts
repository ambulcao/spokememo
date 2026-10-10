import { describe, it, expect, vi, afterEach } from 'vitest';
import { holdBackgroundRecording, isIosBrowser } from './backgroundRecording';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('holdBackgroundRecording', () => {
  it('starts a silent audio session and a native media notification', async () => {
    const close = vi.fn();
    const stop = vi.fn();
    const setActionHandler = vi.fn();
    class FakeContext {
      state = 'running';
      resume = vi.fn();
      createOscillator() {
        return { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop };
      }
      createGain() {
        return { gain: { value: 1 }, connect: vi.fn() };
      }
      close = close;
      destination = {};
    }
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal(
      'MediaMetadata',
      class {
        title: string;
        artist: string;
        constructor(init: { title: string; artist: string }) {
          this.title = init.title;
          this.artist = init.artist;
        }
      }
    );
    const session = {
      metadata: null as MediaMetadata | null,
      playbackState: 'none',
      setActionHandler,
    };
    Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });

    const release = await holdBackgroundRecording(() => {});
    expect(session.playbackState).toBe('playing');
    expect(session.metadata?.title).toBe('Gravando reunião');
    expect(setActionHandler).toHaveBeenCalledWith('stop', expect.any(Function));

    release();
    expect(close).toHaveBeenCalled();
    expect(session.playbackState).toBe('none');
  });

  it('does not treat this browser as an iPhone', () => {
    expect(isIosBrowser()).toBe(false);
  });
});
