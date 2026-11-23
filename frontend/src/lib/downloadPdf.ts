/*
 * "Download PDF" (MW_003 B6, plan §5 item 36): the element is captured as the browser draws it
 * (Arabic shaping, RTL and the Cairo font stay correct), then placed on one A4 page. Both
 * libraries are loaded on the first click only, in their own chunks. Trade-off: the PDF text
 * is an image, not selectable.
 */

const A4 = { width: 210, height: 297 }; // mm
const MARGIN = 15; // mm

export async function downloadElementAsPdf(element: HTMLElement, fileName: string) {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  const { width, height } = element.getBoundingClientRect();
  // JPEG on the card's own background (a 2× PNG of the card was ≈ 5 MB); the page is the
  // frame, so the card's shadow and rounded corners are left out
  const image = await toJpeg(element, {
    pixelRatio: 2,
    quality: 0.92,
    backgroundColor: getComputedStyle(element).backgroundColor,
    style: { boxShadow: 'none', borderRadius: '0', margin: '0' },
  });

  // fit the card inside the margins, keep its proportions, centre it horizontally
  const scale = Math.min((A4.width - 2 * MARGIN) / width, (A4.height - 2 * MARGIN) / height);
  const w = width * scale;
  const h = height * scale;
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  pdf.addImage(image, 'JPEG', (A4.width - w) / 2, MARGIN, w, h);
  pdf.save(fileName);
}
