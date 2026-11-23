import { useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Paperclip, X } from 'lucide-react';
import { allowedOrderMimes, type OrderUploadPurpose, type UploadedFile } from '@mirhalgo/shared';
import { ProgressBar } from '../../../components/ui';
import { useField } from '../../../components/ui/useField';
import { errorKey } from '../../../lib/apiClient';
import { formatFileSize } from '../../../lib/utils';
import { ordersApi } from '../../../services/api/orders';
import { checkPickedOrderFile } from '../attachments';

const ACCEPT: Record<'images' | 'documents', string> = {
  images: 'image/jpeg,image/png,image/webp',
  documents: '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp',
};

type Pending = { key: number; name: string; progress: number; error?: string };

type AttachmentFieldProps = {
  label: ReactNode;
  purpose: OrderUploadPurpose;
  /** Files already uploaded (kept in the form / draft). */
  value: readonly UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  /** Maximum number of files (1 = a single file). */
  max?: number;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

/**
 * Order attachments (MW_003 B3, spec B7 "Uploads"): each picked file is checked by content,
 * then uploaded at once with its own progress bar; removing deletes it on the server. The
 * form keeps only the uploaded files' metadata (ids go with the draft and the order).
 */
export function AttachmentField({
  label,
  purpose,
  value,
  onChange,
  max = 1,
  hint,
  error,
  required,
  disabled,
}: AttachmentFieldProps) {
  const { t, i18n } = useTranslation();
  const images = allowedOrderMimes(purpose).every((mime) => mime.startsWith('image/'));
  const defaultHint = t(`ui.attachments.${images ? 'screenshotsHint' : 'documentsHint'}`);
  const fullHint = (
    <>
      {hint ?? defaultHint}
      {max > 1 && <span className="block">{t('ui.attachments.maxFiles', { max })}</span>}
    </>
  );
  const { fieldId, errorId, hintId, ariaProps } = useField({ error, hint: fullHint });
  const [pending, setPending] = useState<Pending[]>([]);
  const nextKey = useRef(0);
  // the latest value, updated at once on every change: uploads that finish together must not
  // overwrite each other with a stale list
  const current = useRef(value);
  current.current = value;
  const commit = (files: UploadedFile[]) => {
    current.current = files;
    onChange(files);
  };

  const update = (key: number, change: Partial<Pending> | null) =>
    setPending((rows) =>
      change === null
        ? rows.filter((row) => row.key !== key)
        : rows.map((row) => (row.key === key ? { ...row, ...change } : row)),
    );

  const uploadOne = async (file: File) => {
    const key = nextKey.current++;
    setPending((rows) => [...rows, { key, name: file.name, progress: 0 }]);
    const problem = await checkPickedOrderFile(file, purpose).catch(
      () => 'validation.orderFileType',
    );
    if (problem) return update(key, { error: t(problem) });
    try {
      const uploaded = await ordersApi.uploadFile(file, purpose, (progress) =>
        update(key, { progress }),
      );
      update(key, null);
      commit([...current.current, uploaded]);
    } catch (uploadError) {
      update(key, { error: t(errorKey(uploadError)) });
    }
  };

  const onPick = (files: FileList | null) => {
    const picked = [...(files ?? [])];
    const inProgress = pending.filter((row) => !row.error).length;
    const free = Math.max(0, max - value.length - inProgress);
    picked.slice(0, free).forEach((file) => void uploadOne(file));
    for (const file of picked.slice(free)) {
      const key = nextKey.current++;
      setPending((rows) => [
        ...rows,
        { key, name: file.name, progress: 0, error: t('ui.attachments.tooMany', { max }) },
      ]);
    }
  };

  const remove = (file: UploadedFile) => {
    commit(current.current.filter((f) => f.id !== file.id));
    // the server copy goes now; if this fails, the 24 h cleanup removes it
    void ordersApi.deleteUpload(file.id).catch(() => {});
  };

  const full = value.length + pending.filter((row) => !row.error).length >= max;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${fieldId}-label`} className="text-small font-semibold text-heading">
        {label}
        {required && (
          <span aria-hidden="true" className="ms-0.5 text-error">
            *
          </span>
        )}
      </span>

      <div>
        <input
          id={fieldId}
          type="file"
          multiple={max > 1}
          accept={ACCEPT[images ? 'images' : 'documents']}
          disabled={disabled || full}
          aria-labelledby={`${fieldId}-label`}
          aria-required={required || undefined}
          onChange={(event) => {
            onPick(event.target.files);
            event.target.value = ''; // the same file can be picked again
          }}
          className="peer sr-only"
          {...ariaProps}
        />
        <label
          htmlFor={fieldId}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border border-dashed border-blue-600 bg-blue-50 px-4 text-small font-semibold text-link peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          <Paperclip aria-hidden="true" className="size-4" />
          {t('ui.attachments.choose')}
        </label>
      </div>

      {(value.length > 0 || pending.length > 0) && (
        <ul className="flex flex-col gap-2">
          {value.map((file) => (
            <li
              key={file.id}
              className="flex items-center gap-3 rounded-sm border border-slate-200 bg-white px-3 py-2"
            >
              <FileText aria-hidden="true" className="size-5 shrink-0 text-blue-600" />
              <span dir="auto" className="min-w-0 flex-1 truncate text-small text-heading">
                {file.name}
              </span>
              <span className="text-caption text-muted">
                {formatFileSize(file.size, i18n.language)}
              </span>
              <button
                type="button"
                onClick={() => remove(file)}
                disabled={disabled}
                aria-label={t('ui.attachments.remove', { name: file.name })}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-slate-50 hover:text-heading"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
          {pending.map((row) => (
            <li
              key={row.key}
              className="flex flex-col gap-2 rounded-sm border border-slate-200 bg-white px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <FileText aria-hidden="true" className="size-5 shrink-0 text-muted" />
                <span dir="auto" className="min-w-0 flex-1 truncate text-small text-heading">
                  {row.name}
                </span>
                {row.error && (
                  <button
                    type="button"
                    onClick={() => update(row.key, null)}
                    aria-label={t('ui.attachments.dismiss')}
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-slate-50"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                )}
              </div>
              {row.error ? (
                <p role="alert" className="text-caption text-error">
                  {row.error}
                </p>
              ) : (
                <ProgressBar
                  value={row.progress}
                  label={t('ui.attachments.progress', { name: row.name })}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <div id={hintId} className="text-caption text-muted">
        {fullHint}
      </div>
      {error && (
        <p id={errorId} className="text-caption text-error">
          {t(error)}
        </p>
      )}
    </div>
  );
}
