import type { ChangeEvent, DragEvent, RefObject } from 'react';
import { Row, Col } from '@govtechsg/sgds-react';
import FileUploadCard from './FileUploadCard';
import RecordingCard from './RecordingCard';
import RecentJobsList from './RecentJobsList';
import type { RecentJob } from '../../types/api';

interface UploadViewProps {
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: DragEvent<HTMLDivElement>) => void;
  recentJobs: RecentJob[];
  loadingJobs: boolean;
  handleLoadJob: (job: RecentJob) => void;
  handleDeleteJob: (uuid: string) => Promise<void> | void;
  onStartRecording: () => void;
  onStartPlaybackRecording: () => void;
  isRecording: boolean;
  captureMode: 'microphone' | 'playback' | null;
  selectedLanguage: string | null;
  onLanguageChange: (language: string | null) => void;
  targetLanguage: string | null;
  onTargetLanguageChange: (language: string | null) => void;
}

export default function UploadView({
  uploading,
  fileInputRef,
  handleFileSelect,
  handleDragOver,
  handleDrop,
  recentJobs,
  loadingJobs,
  handleLoadJob,
  handleDeleteJob,
  onStartRecording,
  onStartPlaybackRecording,
  isRecording,
  captureMode,
  selectedLanguage,
  onLanguageChange,
  targetLanguage,
  onTargetLanguageChange,
}: UploadViewProps) {
  return (
    <Row className="justify-content-center">
      <Col lg={10}>
        <div className="text-center mb-4">
          <h2 className="mb-2">Comece a transcrição da reunião</h2>
          <p className="text-muted">
            Envie uma gravação ou grave ao vivo para obter a transcrição com identificação de
            falantes
          </p>
        </div>

        <Row className="g-4">
          <Col md={6}>
            <FileUploadCard
              uploading={uploading}
              fileInputRef={fileInputRef}
              handleFileSelect={handleFileSelect}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              selectedLanguage={selectedLanguage}
              onLanguageChange={onLanguageChange}
              targetLanguage={targetLanguage}
              onTargetLanguageChange={onTargetLanguageChange}
            />
          </Col>

          <Col md={6}>
            <RecordingCard
              onStartRecording={onStartRecording}
              onStartPlaybackRecording={onStartPlaybackRecording}
              isRecording={isRecording}
              captureMode={captureMode}
              targetLanguage={targetLanguage}
              onTargetLanguageChange={onTargetLanguageChange}
            />
          </Col>
        </Row>

        <RecentJobsList
          recentJobs={recentJobs}
          loadingJobs={loadingJobs}
          handleLoadJob={handleLoadJob}
          handleDeleteJob={handleDeleteJob}
        />
      </Col>
    </Row>
  );
}
