import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderUploadPurpose, UploadedFile } from '@mirhalgo/shared';

/* Order attachments field (MW_003 B3): content check, one upload + progress per file, remove. */

let release: (() => void) | null = null;
const uploadFile = vi.fn(
  (file: File, purpose: string, onProgress?: (p: number) => void): Promise<UploadedFile> => {
    onProgress?.(40);
    return new Promise((resolve, reject) => {
      const done = () =>
        file.name.startsWith('fail')
          ? reject(Object.assign(new Error('x'), { code: 'FILE_TYPE_NOT_ALLOWED' }))
          : resolve({
              id: `id-${file.name}`,
              purpose: purpose as OrderUploadPurpose,
              name: file.name,
              mime: 'application/pdf',
              size: file.size,
              createdAt: '2026-11-22T12:00:00Z',
            });
      if (file.name.startsWith('slow')) release = done;
      else done();
    });
  },
);
const deleteUpload = vi.fn(async () => null);
vi.mock('../src/services/api/orders', () => ({ ordersApi: { uploadFile, deleteUpload } }));
vi.mock('../src/lib/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/apiClient')>();
  // the mock rejects with a plain error carrying `code`: map it like an ApiRequestError
  return { ...actual, errorKey: (e: { code?: string }) => `errors.${e.code ?? 'INTERNAL'}` };
});

const { AttachmentField } = await import('../src/features/requests/components/AttachmentField');

function Harness({
  purpose = 'document',
  max = 2,
}: {
  purpose?: OrderUploadPurpose;
  max?: number;
}) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  return (
    <>
      <AttachmentField
        label="Shipment documents"
        purpose={purpose}
        max={max}
        value={files}
        onChange={setFiles}
      />
      <span data-testid="ids">{files.map((f) => f.id).join(',')}</span>
    </>
  );
}

const pdf = (name: string) => new File(['%PDF-1.7 test'], name, { type: 'application/pdf' });
const input = () => screen.getByLabelText('Shipment documents') as HTMLInputElement;
const ids = () => screen.getByTestId('ids').textContent;

beforeEach(() => {
  uploadFile.mockClear();
  deleteUpload.mockClear();
  release = null;
});

describe('AttachmentField', () => {
  it('uploads a picked file with its own progress bar, then lists it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.upload(input(), pdf('slow-invoice.pdf'));
    const bar = await screen.findByRole('progressbar', {
      name: 'Upload progress of slow-invoice.pdf',
    });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    release!();
    await waitFor(() => expect(ids()).toBe('id-slow-invoice.pdf'));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('slow-invoice.pdf')).toBeInTheDocument();
    expect(uploadFile).toHaveBeenCalledWith(expect.any(File), 'document', expect.any(Function));
  });

  it('checks the content before uploading: a renamed EXE never leaves the browser', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness />);
    await user.upload(
      input(),
      new File(['MZ\u0090\u0000'], 'invoice.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Upload a PDF, Word, Excel, CSV or image file (JPG, PNG, WEBP)',
    );
    expect(uploadFile).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('screenshots accept images only', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness purpose="screenshot" />);
    await user.upload(input(), pdf('cart.pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Upload an image (JPG, PNG or WEBP)',
    );
  });

  it('respects the maximum: extra files get an error and the picker is disabled when full', async () => {
    const user = userEvent.setup();
    render(<Harness max={2} />);
    await user.upload(input(), [pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')]);
    await waitFor(() => expect(ids()).toBe('id-a.pdf,id-b.pdf'));
    expect(screen.getByRole('alert')).toHaveTextContent('You can attach up to 2 files.');
    expect(input()).toBeDisabled();
  });

  it('shows the server error on the file; remove deletes the upload on the server', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.upload(input(), pdf('fail.pdf'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'One of the files is not an allowed type.',
    );
    await user.upload(input(), pdf('ok.pdf'));
    await waitFor(() => expect(ids()).toBe('id-ok.pdf'));
    const row = screen.getByText('ok.pdf').closest('li')!;
    await user.click(within(row).getByRole('button', { name: 'Remove ok.pdf' }));
    expect(ids()).toBe('');
    expect(deleteUpload).toHaveBeenCalledWith('id-ok.pdf');
  });
});
