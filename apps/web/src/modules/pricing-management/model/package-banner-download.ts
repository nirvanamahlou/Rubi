type BannerExport = {
  format: 'PNG' | 'PDF';
  width: number;
  height: number;
  filename: string;
};
type Capture = (
  element: HTMLElement,
  options: Record<string, unknown>,
) => Promise<HTMLCanvasElement>;
type Pdf = {
  addImage: (
    image: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  save: (name: string) => void;
};
type Libraries = {
  html2canvas?: Capture;
  jspdf?: { jsPDF: new (options: Record<string, unknown>) => Pdf };
};
const loads = new Map<string, Promise<void>>();
function loadScript(path: string) {
  const pending = loads.get(path);
  if (pending) return pending;
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(), 20_000);
    const fail = () => {
      clearTimeout(timer);
      script.remove();
      loads.delete(path);
      reject(new Error('Banner library unavailable'));
    };
    script.src = path;
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
  loads.set(path, promise);
  return promise;
}
export function bannerExportDimensions(
  width: number,
  height: number,
  screenWidth: number,
) {
  if (
    ![width, height].every(
      (n) => Number.isSafeInteger(n) && n > 0 && n <= 8192,
    ) ||
    width * height > 32_000_000 ||
    !Number.isFinite(screenWidth) ||
    screenWidth <= 0
  )
    throw new Error('Invalid banner dimensions');
  return {
    scale: width / screenWidth,
    width: screenWidth,
    height: (screenWidth * height) / width,
  };
}
/** Normalize modern CSS colors for the bundled canvas renderer, keeping the original preview untouched. */
function compatibleClone(doc: Document) {
  const root = doc.querySelector<HTMLElement>('[data-package-banner-preview]');
  if (!root) throw new Error('Banner preview missing');
  const context = doc
    .createElement('canvas')
    .getContext('2d', { willReadFrequently: true });
  const view = doc.defaultView;
  if (!context || !view) throw new Error('Canvas unavailable');
  const properties = [
    'color',
    'background-color',
    'border-top-color',
    'border-right-color',
    'border-bottom-color',
    'border-left-color',
    'text-decoration-color',
  ];
  for (const node of [root, ...root.querySelectorAll<HTMLElement>('*')]) {
    const style = view.getComputedStyle(node);
    for (const property of properties) {
      const value = style.getPropertyValue(property);
      if (!value || /^(?:rgba?\(|transparent$)/.test(value)) continue;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      node.style.setProperty(
        property,
        'rgba(' + r + ',' + g + ',' + b + ',' + a! / 255 + ')',
      );
    }
    node.style.boxShadow = 'none';
    node.style.filter = 'none';
    node.style.backdropFilter = 'none';
  }
}
/** Browser-local download of published, sale-only content; no upload or Documents mutation. */
export async function downloadPackageBanner(
  element: HTMLElement,
  options: BannerExport,
) {
  const bounds = element.getBoundingClientRect();
  const dimensions = bannerExportDimensions(
    options.width,
    options.height,
    bounds.width,
  );
  const libraries = window as unknown as Libraries;
  if (!libraries.html2canvas)
    await loadScript('/package-generator/vendor/html2canvas.js');
  if (options.format === 'PDF' && !libraries.jspdf)
    await loadScript('/package-generator/vendor/jspdf.js');
  if (!libraries.html2canvas) throw new Error('Canvas renderer unavailable');
  await document.fonts.ready;
  const canvas = await libraries.html2canvas(element, {
    ...dimensions,
    backgroundColor: null,
    useCORS: false,
    allowTaint: false,
    logging: false,
    onclone: compatibleClone,
  });
  const name =
    options.filename.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) ||
    'package-banner';
  if (options.format === 'PDF') {
    if (!libraries.jspdf) throw new Error('PDF renderer unavailable');
    const pdf = new libraries.jspdf.jsPDF({
      orientation: options.width > options.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [options.width, options.height],
      hotfixes: ['px_scaling'],
    });
    pdf.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      0,
      0,
      options.width,
      options.height,
    );
    pdf.save(name + '.pdf');
  } else {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Empty banner'))),
        'image/png',
      ),
    );
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = name + '.png';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }
  }
}
