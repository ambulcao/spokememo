import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useAudioRecording from './useAudioRecording';
import * as api from '../services/api';

vi.mock('../services/api');

// Minimal MediaRecorder stand-in that lets tests drive the stop -> upload flow.
const instances: FakeMediaRecorder[] = [];
class FakeMediaRecorder {
  static isTypeSupported = vi.fn(() => true);
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = 'inactive';
  constructor() {
    instances.push(this);
  }
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['audio-bytes']) });
    this.onstop?.();
  }
}

function setup() {
  const setError = vi.fn();
  const setCurrentStep = vi.fn();
  const setProcessingProgress = vi.fn();
  const setJobId = vi.fn();
  const setTranscript = vi.fn();
  const startPolling = vi.fn();
  const hook = renderHook(() =>
    useAudioRecording(
      setError,
      setCurrentStep,
      setProcessingProgress,
      setJobId,
      setTranscript,
      startPolling
    )
  );
  return { hook, setError, setCurrentStep, setJobId, setTranscript, startPolling };
}

beforeEach(() => {
  instances.length = 0;
  vi.clearAllMocks();
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useAudioRecording', () => {
  it('requests the microphone and starts recording', async () => {
    const { hook } = setup();
    await act(async () => {
      await hook.result.current.startRecording();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    expect(hook.result.current.isRecording).toBe(true);
    expect(instances).toHaveLength(1);
  });

  it('uploads the recording on stop and starts polling for a new job', async () => {
    vi.mocked(api.uploadAudio).mockResolvedValue({ uuid: 'rec1', status_code: 202 });
    const { hook, setJobId, startPolling } = setup();

    await act(async () => {
      await hook.result.current.startRecording();
    });
    await act(async () => {
      instances[0].stop();
    });

    await waitFor(() => expect(api.uploadAudio).toHaveBeenCalled());
    expect(setJobId).toHaveBeenCalledWith('rec1');
    expect(startPolling).toHaveBeenCalledWith('rec1');
  });

  it('loads the existing transcript when the recording is a duplicate (200)', async () => {
    vi.mocked(api.uploadAudio).mockResolvedValue({ uuid: 'rec1', status_code: 200 });
    vi.mocked(api.getTranscript).mockResolvedValue({ segments: [] });
    const { hook, setCurrentStep, setTranscript } = setup();

    await act(async () => {
      await hook.result.current.startRecording();
    });
    await act(async () => {
      instances[0].stop();
    });

    await waitFor(() => expect(setCurrentStep).toHaveBeenCalledWith('transcript'));
    expect(setTranscript).toHaveBeenCalledWith({ segments: [] });
  });

  it('records the shared tab audio and uploads it for transcription', async () => {
    const audio = { stop: vi.fn(), kind: 'audio' };
    const video = { stop: vi.fn(), kind: 'video', addEventListener: vi.fn() };
    const displayStream = {
      getAudioTracks: () => [audio],
      getVideoTracks: () => [video],
      getTracks: () => [audio, video],
    };
    const getDisplayMedia = vi.fn().mockResolvedValue(displayStream);
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(), getDisplayMedia },
      configurable: true,
    });
    vi.stubGlobal('MediaStream', class { constructor(public tracks: unknown[]) {} });
    vi.mocked(api.uploadAudio).mockResolvedValue({ uuid: 'vid1', status_code: 202 });
    const { hook, startPolling } = setup();

    await act(async () => {
      await hook.result.current.startPlaybackRecording();
    });

    expect(getDisplayMedia).toHaveBeenCalled();
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
    expect(hook.result.current.captureMode).toBe('playback');

    await act(async () => {
      instances[0].stop();
    });

    await waitFor(() => expect(api.uploadAudio).toHaveBeenCalled());
    const file = vi.mocked(api.uploadAudio).mock.calls[0][0] as File;
    expect(file.name.startsWith('video-')).toBe(true);
    expect(startPolling).toHaveBeenCalledWith('vid1');
  });

  it('asks for the tab audio checkbox when the share has no sound', async () => {
    const stop = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(),
        getDisplayMedia: vi.fn().mockResolvedValue({
          getAudioTracks: () => [],
          getTracks: () => [{ stop }],
        }),
      },
      configurable: true,
    });
    const { hook, setError } = setup();

    await act(async () => {
      await hook.result.current.startPlaybackRecording();
    });

    expect(setError).toHaveBeenCalledWith(expect.stringMatching(/marque o áudio da aba/i));
    expect(hook.result.current.isRecording).toBe(false);
    expect(stop).toHaveBeenCalled();
  });

  it('reports a permission error when the mic is blocked', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(denied);
    const { hook, setError } = setup();

    await act(async () => {
      await hook.result.current.startRecording();
    });

    expect(setError).toHaveBeenCalledWith(expect.stringMatching(/microphone access denied/i));
    expect(hook.result.current.isRecording).toBe(false);
  });
});
