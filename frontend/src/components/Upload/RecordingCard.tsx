import { Card, Button, Alert } from '@govtechsg/sgds-react';
import { Mic, AlertCircle, MonitorPlay } from 'lucide-react';
import { getRecordingUnavailableReason } from '../../utils/browserUtils';
import { canCapturePlayback } from '../../utils/playbackCapture';
import TranslateTargetSelect from './TranslateTargetSelect';

interface RecordingCardProps {
  onStartRecording: () => void;
  onStartPlaybackRecording?: () => void;
  isRecording: boolean;
  captureMode?: 'microphone' | 'playback' | null;
  targetLanguage?: string | null;
  onTargetLanguageChange?: (language: string | null) => void;
}

export default function RecordingCard({
  onStartRecording,
  onStartPlaybackRecording,
  isRecording,
  captureMode = null,
  targetLanguage = null,
  onTargetLanguageChange,
}: RecordingCardProps) {
  const unavailableReason = getRecordingUnavailableReason();
  const isDisabled = !!unavailableReason || isRecording;
  const playbackAvailable = canCapturePlayback();

  return (
    <Card className="h-100 record-card">
      <Card.Body className="text-center p-5 d-flex flex-column justify-content-center">
        <div className="record-icon my-4">
          <Mic size={64} strokeWidth={1.5} className="text-danger" />
        </div>
        <h4 className="mb-3">Gravar reunião ao vivo</h4>
        <p className="text-muted mb-4">Grave o áudio direto do microfone</p>
        {onTargetLanguageChange && (
          <TranslateTargetSelect
            value={targetLanguage}
            onChange={onTargetLanguageChange}
            disabled={isRecording}
          />
        )}
        <div className="record-info mb-4">
          {unavailableReason ? (
            <Alert variant="warning" className="mb-0">
              <div className="d-flex align-items-start gap-2">
                <AlertCircle size={20} className="flex-shrink-0 mt-1" />
                <small>{unavailableReason}</small>
              </div>
            </Alert>
          ) : (
            <Alert variant="info" className="mb-0">
              <small>
                <strong>Dica:</strong> para um resultado melhor, use um microfone de qualidade e
                reduza o ruído de fundo
              </small>
            </Alert>
          )}
        </div>
        <div title={unavailableReason || ''}>
          <Button
            variant="danger"
            size="lg"
            className="w-100"
            disabled={isDisabled}
            onClick={onStartRecording}
          >
            <Mic size={20} className="me-2" />
            {isRecording && captureMode !== 'playback' ? 'Gravando...' : 'Iniciar gravação'}
          </Button>
        </div>
        {onStartPlaybackRecording && (
          <div className="mt-3">
            <Button
              variant="outline-danger"
              size="lg"
              className="w-100"
              disabled={isDisabled || !playbackAvailable}
              onClick={onStartPlaybackRecording}
            >
              <MonitorPlay size={20} className="me-2" />
              {isRecording && captureMode === 'playback' ? 'Gravando...' : 'Gravar áudio do vídeo'}
            </Button>
            <small className="text-muted d-block mt-2">
              {playbackAvailable
                ? 'Abra o YouTube numa aba do Chrome, escolha essa aba, marque o áudio e dê play.'
                : 'Neste celular o Chrome não grava o som do YouTube. No computador, use o Chrome e compartilhe a aba do vídeo.'}
            </small>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
