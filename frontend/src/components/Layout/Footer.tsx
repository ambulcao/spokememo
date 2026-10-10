import { Container, Row, Col } from '@govtechsg/sgds-react';

export default function Footer() {
  return (
    <footer className="app-footer mt-auto py-4 bg-light">
      <Container>
        <Row>
          <Col className="text-center text-muted">
            <small>SpokeMemo &copy; {new Date().getFullYear()} - Transcrição de reuniões com IA</small>
          </Col>
        </Row>
      </Container>
    </footer>
  );
}
