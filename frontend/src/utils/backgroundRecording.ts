/**
 * Keep a microphone recording alive when the phone locks or the browser
 * goes to the background.
 *
 * Android Chrome already captures audio in the background through MediaRecorder.
 * A silent audio output plus a media-session notification tell the system the
 * page is still playing, so it does not freeze or discard the tab.
 */

type Release = () => void;

export function isIosBrowser(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export async function holdBackgroundRecording(onStop: () => void): Promise<Release> {
  const releaseAudio = await startSilentAudio();
  const releaseSession = startMediaSession(onStop);
  return () => {
    releaseAudio();
    releaseSession();
  };
}

async function startSilentAudio(): Promise<Release> {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return () => {};

  try {
    const context = new AudioContextCtor();
    if (context.state === 'suspended') {
      await context.resume();
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    // A true zero is often optimized away, which lets the system suspend the page.
    gain.gain.value = 0.00001;
    oscillator.frequency.value = 20;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    return () => {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
      void context.close();
    };
  } catch {
    return () => {};
  }
}

function startMediaSession(onStop: () => void): Release {
  const session = navigator.mediaSession;
  if (!session) return () => {};

  try {
    if (typeof MediaMetadata !== 'undefined') {
      session.metadata = new MediaMetadata({
        title: 'Gravando reunião',
        artist: 'SpokeMemo',
      });
    }
    session.playbackState = 'playing';
    session.setActionHandler('stop', () => onStop());
  } catch {
    return () => {};
  }

  return () => {
    try {
      session.playbackState = 'none';
      session.metadata = null;
      session.setActionHandler('stop', null);
    } catch {
      // The browser may already have cleared the session.
    }
  };
}
