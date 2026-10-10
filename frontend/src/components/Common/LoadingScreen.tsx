import { Container, Row, Col, Card, ProgressBar, Button, Alert } from '@govtechsg/sgds-react';
import { AlertCircle } from 'lucide-react';
import logo from '../../assets/logo.svg';

interface LoadingScreenProps {
  backendError: string | null;
}

export default function LoadingScreen({ backendError }: LoadingScreenProps) {
  // Show error screen if backend failed to load
  if (backendError) {
    return (
      <div
        className="app d-flex align-items-center justify-content-center"
        style={{ minHeight: '100vh', backgroundColor: 'var(--mm-bg, #f8fafc)' }}
      >
        <Container>
          <Row className="justify-content-center">
            <Col md={6} className="text-center">
              <Card className="shadow-sm border-0">
                <Card.Body className="p-5">
                  <AlertCircle size={64} className="text-secondary mb-4" />
                  <h2 className="mb-3">Erro de conexão</h2>
                  <Alert variant="danger" className="mb-4">
                    {backendError}
                  </Alert>
                  <p className="text-muted mb-4">
                    Verifique se o servidor está em execução e atualize a página.
                  </p>
                  <Button variant="primary" onClick={() => window.location.reload()}>
                    Tentar novamente
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </div>
    );
  }

  // Show loading screen while backend is initializing
  return (
    <div
      className="app d-flex align-items-center justify-content-center"
      style={{ minHeight: '100vh', backgroundColor: 'var(--mm-bg, #f8fafc)' }}
    >
      <Container>
        <Row className="justify-content-center">
          <Col md={6} className="text-center">
            <Card className="shadow-sm border-0">
              <Card.Body className="p-5">
                <img src={logo} alt="" width={72} height={72} className="my-4" />
                <h2 className="mb-3">SpokeMemo</h2>
                <p className="text-muted mb-4">Transcrição de reuniões com IA</p>
                <div className="spinner-border text-primary mb-3" role="status">
                  <span className="visually-hidden">Carregando...</span>
                </div>
                <p className="text-muted small">Conectando ao servidor...</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
}
