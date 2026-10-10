import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RecordingCard from './RecordingCard';

// jsdom's default host is localhost (a secure context), so recording support
// hinges on the presence of mediaDevices.getUserMedia + MediaRecorder.
function enableRecordingApis() {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn() },
    configurable: true,
    writable: true,
  });
  vi.stubGlobal('MediaRecorder', function MediaRecorder() {});
}

beforeEach(() => {
  enableRecordingApis();
});

afterEach(() => {
  vi.unstubAllGlobals();
  // @ts-expect-error remove the injected property between tests
  delete navigator.mediaDevices;
});

describe('RecordingCard', () => {
  it('starts recording when supported', () => {
    const onStartRecording = vi.fn();
    render(<RecordingCard onStartRecording={onStartRecording} isRecording={false} />);

    const button = screen.getByRole('button', { name: /iniciar gravação/i });
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onStartRecording).toHaveBeenCalled();
  });

  it('disables the button and warns when recording is unsupported', () => {
    // Simulate a browser without recording support.
    Object.defineProperty(navigator, 'mediaDevices', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    vi.stubGlobal('MediaRecorder', undefined);

    render(<RecordingCard onStartRecording={vi.fn()} isRecording={false} />);
    // The unavailable reason is surfaced as the button wrapper's title, and the
    // button is disabled so recording can't be started.
    expect(screen.getByTitle(/não permite gravação de áudio/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar gravação/i })).toBeDisabled();
  });

  it('starts tab-audio capture when the browser can share a tab', () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(), getDisplayMedia: vi.fn() },
      configurable: true,
    });
    const onStartPlaybackRecording = vi.fn();
    render(
      <RecordingCard
        onStartRecording={vi.fn()}
        onStartPlaybackRecording={onStartPlaybackRecording}
        isRecording={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /gravar áudio do vídeo/i }));
    expect(onStartPlaybackRecording).toHaveBeenCalled();
  });

  it('shows a recording label while recording', () => {
    render(<RecordingCard onStartRecording={vi.fn()} isRecording />);
    expect(screen.getByRole('button', { name: /gravando\.\.\./i })).toBeDisabled();
  });
});
