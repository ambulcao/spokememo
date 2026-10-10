/**
 * Capture the audio of a browser tab (for example a YouTube video).
 *
 * Chrome on a computer can share a tab with its audio. The page receives that
 * audio and records it. Chrome on Android does not offer this API, and the
 * YouTube app does not let other apps take its sound.
 */

export class PlaybackAudioMissingError extends Error {
  constructor() {
    super('O navegador não compartilhou o áudio da aba.');
    this.name = 'PlaybackAudioMissingError';
  }
}

type TabCaptureOptions = DisplayMediaStreamOptions & {
  systemAudio?: 'include' | 'exclude';
  selfBrowserSurface?: 'include' | 'exclude';
  surfaceSwitching?: 'include' | 'exclude';
};

export function canCapturePlayback(): boolean {
  return typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

export async function requestPlaybackStream(): Promise<MediaStream> {
  const options: TabCaptureOptions = {
    video: true,
    audio: true,
    systemAudio: 'include',
    selfBrowserSurface: 'exclude',
    surfaceSwitching: 'include',
  };
  const stream = await navigator.mediaDevices.getDisplayMedia(options);
  if (stream.getAudioTracks().length === 0) {
    stream.getTracks().forEach((track) => track.stop());
    throw new PlaybackAudioMissingError();
  }
  return stream;
}
