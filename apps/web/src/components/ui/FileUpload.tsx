import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import { cn, formatFileSize } from '../../lib/utils';
import { Spinner } from './Spinner';

type FileUploadProps = {
  label: ReactNode;
  /** `accept` attribute (a hint for the picker; the real checks happen in `onSelect`). */
  accept: string;
  /** Hint under the label, e.g. "PDF, JPG or PNG, up to 5 MB". */
  hint?: ReactNode;
  value: File | null;
  /** A file was picked or dropped. The caller validates it and sets `value` / `error`. */
  onSelect: (file: File) => void;
  onRemove: () => void;
  /** i18n key or translated text. */
  error?: string;
  required?: boolean;
  /** e.g. while checking or cropping the picked file. */
  busy?: boolean;
};

/** Thumbnail URL for images (revoked when the file changes). */
function usePreviewUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file?.type.startsWith('image/')) return setUrl(null);
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  return url;
}

/**
 * Drag & drop + click file picker with name, size, preview, Replace and Remove
 * (MW_002 A2 Step 3). The native input stays focusable (keyboard + screen readers).
 */
export function FileUpload({
  label,
  accept,
  hint,
  value,
  onSelect,
  onRemove,
  error,
  required,
  busy = false,
}: FileUploadProps) {
  const { t, i18n } = useTranslation();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const preview = usePreviewUrl(value);
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ');

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onSelect(file);
    // allow picking the same file again after an error
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!busy) pick(event.dataTransfer.files);
  };

  const input = (
    <input
      ref={inputRef}
      id={id}
      type="file"
      accept={accept}
      disabled={busy}
      aria-labelledby={`${id}-label`}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy || undefined}
      aria-required={required || undefined}
      onChange={(event) => pick(event.target.files)}
      className="sr-only"
    />
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-small font-semibold text-heading">
        {label}
        {required && (
          <span aria-hidden="true" className="ms-0.5 text-error">
            *
          </span>
        )}
      </span>
      {hint && (
        <span id={`${id}-hint`} className="text-caption text-muted">
          {hint}
        </span>
      )}

      {value ? (
        <div
          className={cn(
            'flex items-center gap-3 rounded-sm border bg-white p-3 shadow-sm',
            error ? 'border-error' : 'border-slate-200',
          )}
        >
          {preview ? (
            <img
              src={preview}
              alt=""
              className="size-14 shrink-0 rounded-sm border border-slate-200 object-cover"
            />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-sm bg-blue-50 text-blue-600">
              <FileText aria-hidden="true" className="size-6" />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span dir="auto" className="truncate text-small font-semibold text-heading">
              {value.name}
            </span>
            <span className="text-caption text-muted">
              {formatFileSize(value.size, i18n.language)}
            </span>
          </span>
          {busy ? (
            <Spinner />
          ) : (
            <span className="flex shrink-0 gap-1">
              {input}
              <label
                htmlFor={id}
                className="flex size-11 cursor-pointer items-center justify-center rounded-full text-blue-600 hover:bg-blue-50 has-focus-visible:outline-3 has-focus-visible:outline-focus"
              >
                <RefreshCw aria-hidden="true" className="size-5" />
                <span className="sr-only">{t('ui.file.replace')}</span>
              </label>
              <button
                type="button"
                onClick={onRemove}
                className="flex size-11 items-center justify-center rounded-full text-error hover:bg-slate-50"
              >
                <Trash2 aria-hidden="true" className="size-5" />
                <span className="sr-only">{t('ui.file.remove')}</span>
              </button>
            </span>
          )}
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-sm border-2 border-dashed px-4 py-6 text-center transition-colors duration-150 ease-out has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus',
            dragging ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50',
            error && 'border-error',
          )}
        >
          {input}
          {busy ? <Spinner /> : <UploadCloud aria-hidden="true" className="size-8 text-blue-600" />}
          <span className="text-small text-body">
            <span className="font-semibold text-link">{t('ui.file.choose')}</span>{' '}
            {t('ui.file.orDrop')}
          </span>
        </label>
      )}

      {error && (
        <p id={`${id}-error`} className="text-caption text-error">
          {t(error)}
        </p>
      )}
    </div>
  );
}
