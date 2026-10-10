import { Container } from '@govtechsg/sgds-react';
import logo from '../../assets/logo.svg';
import ThemeSwitcher from '../ThemeSwitcher';

interface HeaderProps {
  onStartNewMeeting: () => void;
}

export default function Header({ onStartNewMeeting }: HeaderProps) {
  return (
    <div className="app-header">
      <Container>
        <div className="d-flex align-items-center justify-content-between py-3">
          <div
            className="d-flex align-items-center gap-3"
            style={{ cursor: 'pointer' }}
            onClick={onStartNewMeeting}
          >
            <img src={logo} alt="" width={40} height={40} />
            <div>
              <h4 className="mb-0">SpokeMemo</h4>
              <small className="text-muted">Resumo de reuniões com IA</small>
            </div>
          </div>
          <ThemeSwitcher />
        </div>
      </Container>
    </div>
  );
}
