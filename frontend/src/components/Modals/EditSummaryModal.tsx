import type { Dispatch, SetStateAction } from 'react';
import { Modal, Button, Form } from '@govtechsg/sgds-react';
import { Edit2 } from 'lucide-react';

interface EditSummaryModalProps {
  show: boolean;
  onHide: () => void;
  editingSummary: string;
  setEditingSummary: Dispatch<SetStateAction<string>>;
  handleSaveSummary: () => void;
}

export default function EditSummaryModal({
  show,
  onHide,
  editingSummary,
  setEditingSummary,
  handleSaveSummary,
}: EditSummaryModalProps) {
  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>
          <Edit2 size={20} className="me-2" />
          Editar resumo
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted mb-3">
          Edite o resumo gerado por IA para corrigir imprecisões ou acrescentar detalhes antes de
          exportar.
        </p>
        <Form.Group>
          <Form.Label>Texto do resumo</Form.Label>
          <Form.Control
            as="textarea"
            rows={15}
            value={editingSummary}
            onChange={(e) => setEditingSummary(e.target.value)}
            placeholder="Digite o texto do resumo..."
          />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleSaveSummary}>
          Salvar alterações
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
