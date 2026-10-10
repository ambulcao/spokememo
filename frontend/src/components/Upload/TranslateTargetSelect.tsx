import { Form } from '@govtechsg/sgds-react';
import { TRANSLATION_TARGETS } from '../../constants/languages';

interface TranslateTargetSelectProps {
  value: string | null;
  onChange: (language: string | null) => void;
  disabled?: boolean;
}

export default function TranslateTargetSelect({
  value,
  onChange,
  disabled = false,
}: TranslateTargetSelectProps) {
  return (
    <Form.Group className="mb-3 text-start" style={{ maxWidth: '300px', margin: '0 auto' }}>
      <Form.Label>
        <small className="text-muted">Traduzir para</small>
      </Form.Label>
      <Form.Select
        value={value || ''}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled}
        size="sm"
        aria-label="Traduzir para"
      >
        {TRANSLATION_TARGETS.map((language) => (
          <option key={language.code || 'none'} value={language.code || ''}>
            {language.name}
          </option>
        ))}
      </Form.Select>
    </Form.Group>
  );
}
