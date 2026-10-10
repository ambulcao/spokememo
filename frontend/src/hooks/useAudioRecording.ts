import { useState, useRef, useCallback } from 'react';
import * as api from '../services/api';
import { holdBackgroundRecording } from '../utils/backgroundRecording';
import { PlaybackAudioMissingError, requestPlaybackStream } from '../utils/playbackCapture';
import { normalizeTranscript } from '../utils/transcript';
import type {
  SetCurrentStep,
  SetError,
  SetJobId,
  SetProcessingProgress,
  SetTranscriptWithColors,
  StartPolling,
} from '../types/ui';

export default function useAudioRecording(
  setError: SetError,
  setCurrentStep: SetCurrentStep,
  setProcessingProgress: SetProcessingProgress,
  setJobId: SetJobId,
  setTranscript: SetTranscriptWithColors,
  startPolling: StartPolling,
  targetLanguage: string | null = null
) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [captureMode, setCaptureMode] = useState<'microphone' | 'playback' | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const releaseBackgroundRef = useRef<(() => void) | null>(null);
  const stopRecordingRef = useRef<() => void>(() => {});
  const captureModeRef = useRef<'microphone' | 'playback' | null>(null);

  // Upload recording to backend
  const uploadRecording = useCallback(
    async (audioBlob: Blob) => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const prefix = captureModeRef.current === 'playback' ? 'video' : 'recording';
        const fileName = `${prefix}-${timestamp}.webm`;
        const file = new File([audioBlob], fileName, { type: audioBlob.type });

        // Upload to backend
        setCurrentStep('processing');
        setProcessingProgress(10);

        const response = await api.uploadAudio(file, 'turbo', null, targetLanguage);

        const newJobId = response.uuid;
        setJobId(newJobId);
        setProcessingProgress(20);

        // Check if this is a duplicate
        if (response.status_code === 200) {
          // Duplicate - load existing transcript via the shared API layer,
          // normalizing the full_transcript payload like every other load site.
          const transcriptData = await api.getTranscript(newJobId);
          setTranscript(normalizeTranscript(transcriptData));
          setCurrentStep('transcript');
          setProcessingProgress(100);
        } else {
          // New job - start polling
          startPolling(newJobId);
        }
      } catch (err) {
        console.error('Error uploading recording:', err);
        setError((err as Error).message || 'Failed to upload recording');
        setCurrentStep('upload');
        setProcessingProgress(0);
      } finally {
        // Reset recording state
        setRecordingTime(0);
        audioChunksRef.current = [];
      }
    },
    [setCurrentStep, setProcessingProgress, setJobId, setTranscript, startPolling, setError, targetLanguage]
  );

  const beginRecording = useCallback(async (mode: 'microphone' | 'playback') => {
    try {
      const stream =
        mode === 'playback'
          ? await requestPlaybackStream()
          : await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });

      streamRef.current = stream;
      audioChunksRef.current = [];
      captureModeRef.current = mode;

      // Create MediaRecorder instance
      // Use webm with opus codec for best compatibility and quality
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      // Keep the video track alive: Chrome stops the tab audio if it is stopped.
      // The file itself contains only the audio track.
      const recordedStream = mode === 'playback' ? new MediaStream(stream.getAudioTracks()) : stream;
      const mediaRecorder = new MediaRecorder(recordedStream, {
        mimeType,
        audioBitsPerSecond: 128000, // 128 kbps for good quality
      });

      mediaRecorderRef.current = mediaRecorder;

      // Collect audio chunks. A timeslice lets Chrome flush audio captured
      // while the screen was locked as soon as the page is visible again.
      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      const onVisible = () => {
        if (document.visibilityState !== 'visible') return;
        if (mediaRecorder.state === 'recording' && mediaRecorder.requestData) {
          mediaRecorder.requestData();
        }
        if (startedAtRef.current) {
          setRecordingTime(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }
      };

      const releaseRecording = () => {
        releaseBackgroundRef.current?.();
        releaseBackgroundRef.current = null;
        startedAtRef.current = null;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        document.removeEventListener('visibilitychange', onVisible);
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        releaseRecording();
        await uploadRecording(audioBlob);
      };

      // Start recording. The slice keeps background audio from sitting in one
      // buffer until the very end.
      mediaRecorder.start(1000);
      if (mode === 'playback') {
        stream.getVideoTracks().forEach((track) => {
          track.addEventListener('ended', () => {
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
          });
        });
      }
      document.addEventListener('visibilitychange', onVisible);
      startedAtRef.current = Date.now();
      setCaptureMode(mode);
      setIsRecording(true);
      setRecordingTime(0);
      if (mode === 'microphone') {
        releaseBackgroundRef.current = await holdBackgroundRecording(() => stopRecordingRef.current());
      }

      timerRef.current = setInterval(() => {
        if (!startedAtRef.current) return;
        setRecordingTime(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
    } catch (err) {
      console.error('Error starting recording:', err);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      const error = err as DOMException;
      if (mode === 'playback') {
        if (err instanceof PlaybackAudioMissingError) {
          setError(
            'Marque o áudio da aba na janela de compartilhamento. Sem isso o vídeo chega sem som.'
          );
        } else if (error.name === 'NotAllowedError') {
          setError('A captura da aba foi cancelada.');
        } else {
          setError('Este navegador não entrega o áudio de outra aba ou aplicativo.');
        }
        return;
      }
      if (error.name === 'NotAllowedError') {
        setError('Microphone access denied. Please allow microphone access to record.');
      } else if (error.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(`Failed to start recording: ${error.message}`);
      }
    }
  }, [setError, uploadRecording]);

  const startRecording = useCallback(() => beginRecording('microphone'), [beginRecording]);
  const startPlaybackRecording = useCallback(() => beginRecording('playback'), [beginRecording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      setIsRecording(false);
      setCaptureMode(null);
    }
  }, []);
  stopRecordingRef.current = stopRecording;

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    releaseBackgroundRef.current?.();
    releaseBackgroundRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, []);

  return {
    isRecording,
    recordingTime,
    captureMode,
    startRecording,
    startPlaybackRecording,
    stopRecording,
    cleanup,
  };
}
