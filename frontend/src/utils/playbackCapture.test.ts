import { describe, it, expect, vi, afterEach } from 'vitest';
import { canCapturePlayback, PlaybackAudioMissingError, requestPlaybackStream } from './playbackCapture';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('requestPlaybackStream', () => {
  it('returns the shared tab when it includes audio', async () => {
    const stream = {
      getAudioTracks: () => [{ kind: 'audio' }],
      getTracks: () => [],
    };
    const getDisplayMedia = vi.fn().mockResolvedValue(stream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getDisplayMedia },
      configurable: true,
    });

    await expect(requestPlaybackStream()).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: true, audio: true, systemAudio: 'include' })
    );
    expect(canCapturePlayback()).toBe(true);
  });

  it('stops the share when the browser omits the audio track', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue({
          getAudioTracks: () => [],
          getTracks: () => [{ stop }],
        }),
      },
      configurable: true,
    });

    await expect(requestPlaybackStream()).rejects.toBeInstanceOf(PlaybackAudioMissingError);
    expect(stop).toHaveBeenCalled();
  });
});
