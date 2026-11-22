import { useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from './ui';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

/** Draws the selected square of the image into a PNG file. */
async function cropToFile(url: string, area: Area, name: string, size: number): Promise<File> {
  const image = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext('2d')
    ?.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, size, size);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('crop failed');
  return new File([blob], `${name.replace(/\.[^.]+$/, '') || 'image'}.png`, { type: 'image/png' });
}

/**
 * Square crop into a PNG (company logo, customer avatar). Load it with React.lazy so
 * react-easy-crop stays out of the page chunks.
 */
export default function ImageCropper({
  file,
  title,
  size = 512,
  onCancel,
  onDone,
}: {
  file: File;
  title: string;
  /** Output width = height in px (the API re-encodes logos to 512×512 WEBP anyway). */
  size?: number;
  onCancel: () => void;
  onDone: (file: File) => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  const apply = async () => {
    if (!url || !area) return;
    setBusy(true);
    try {
      onDone(await cropToFile(url, area, file.name, size));
    } catch {
      setBusy(false);
      onCancel();
    }
  };

  return (
    <Modal
      title={title}
      description={t('ui.crop.description')}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" shape="form" onClick={onCancel}>
            {t('ui.crop.cancel')}
          </Button>
          <Button shape="form" onClick={apply} loading={busy} disabled={!area} data-autofocus>
            {t('ui.crop.apply')}
          </Button>
        </>
      }
    >
      <div className="relative h-72 w-full overflow-hidden rounded-sm bg-navy-900">
        {url && (
          <Cropper
            image={url}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        )}
      </div>
      <label className="flex items-center gap-3 text-small font-semibold text-heading">
        {t('ui.crop.zoom')}
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="flex-1 accent-blue-600"
        />
      </label>
    </Modal>
  );
}
