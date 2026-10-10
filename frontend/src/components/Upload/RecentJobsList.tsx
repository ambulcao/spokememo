import { useState } from 'react';
import type { MouseEvent } from 'react';
import { Card, Badge, Button, Modal } from '@govtechsg/sgds-react';
import { Clock, AlertCircle, Trash2 } from 'lucide-react';
import type { RecentJob } from '../../types/api';

const DATE_TIME_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

interface RecentJobsListProps {
  recentJobs: RecentJob[];
  loadingJobs: boolean;
  handleLoadJob: (job: RecentJob) => void;
  handleDeleteJob: (uuid: string) => Promise<void> | void;
}

export default function RecentJobsList({
  recentJobs,
  loadingJobs,
  handleLoadJob,
  handleDeleteJob,
}: RecentJobsListProps) {
  const [pendingDeleteUuid, setPendingDeleteUuid] = useState<string | null>(null);

  const onDeleteClick = (uuid: string, e: MouseEvent) => {
    e.stopPropagation();
    setPendingDeleteUuid(uuid);
  };

  const onConfirmDelete = async () => {
    if (pendingDeleteUuid) {
      await handleDeleteJob(pendingDeleteUuid);
    }
    setPendingDeleteUuid(null);
  };

  return (
    <>
      <Card className="mt-4">
        <Card.Header>
          <h5 className="mb-0">
            <Clock size={20} className="me-2" />
            Reuniões recentes
          </h5>
        </Card.Header>
        <Card.Body className="p-0">
          {loadingJobs ? (
            <div className="text-center text-muted py-4">
              <div className="spinner-border spinner-border-sm me-2" role="status">
                <span className="visually-hidden">Carregando...</span>
              </div>
              <span>Carregando reuniões recentes...</span>
            </div>
          ) : recentJobs.length > 0 ? (
            <div className="list-group list-group-flush">
              {recentJobs.map((job) => (
                <div
                  key={job.uuid}
                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleLoadJob(job)}
                >
                  <div className="flex-grow-1">
                    <div className="fw-medium">{job.filename || 'Gravação sem título'}</div>
                    <small className="text-muted">
                      {job.created_at
                        ? new Date(job.created_at).toLocaleString('pt-BR', DATE_TIME_FORMAT_OPTIONS)
                        : 'Data desconhecida'}
                    </small>
                  </div>
                  <div className="d-flex gap-2 align-items-center">
                    <Badge
                      bg={
                        job.status_code === 200 || job.status_code === '200'
                          ? 'success'
                          : job.status_code === 202 || job.status_code === '202'
                            ? 'warning'
                            : 'danger'
                      }
                    >
                      {job.status_code === 200 || job.status_code === '200'
                        ? 'Concluída'
                        : job.status_code === 202 || job.status_code === '202'
                          ? 'Processando'
                          : 'Falhou'}
                    </Badge>
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 text-danger d-flex align-items-center"
                      onClick={(e) => onDeleteClick(job.uuid, e)}
                      title="Excluir esta reunião"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted py-4">
              <p className="mb-0">
                Nenhuma reunião recente. Envie ou grave a primeira para começar.
              </p>
            </div>
          )}
          <div className="card-footer text-muted small">
            <AlertCircle size={14} className="me-1" />
            As reuniões são excluídas automaticamente após 24 horas
          </div>
        </Card.Body>
      </Card>

      <Modal show={!!pendingDeleteUuid} onHide={() => setPendingDeleteUuid(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Excluir reunião</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Tem certeza de que deseja excluir esta reunião? Essa ação não pode ser desfeita.
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => setPendingDeleteUuid(null)}
          >
            Cancelar
          </button>
          <button type="button" className="btn btn-outline-danger" onClick={onConfirmDelete}>
            Excluir
          </button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
