import type { ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

/** Yes/no question in a modal (leave page, discard draft…). Cancel is focused first. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      size="sm"
      title={title}
      description={description}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={onCancel} data-autofocus>
            {cancelLabel}
          </Button>
          <Button variant={tone} shape="form" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
