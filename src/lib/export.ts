// Fix 11 (R1-M3/R2-M7): lazy-import html2canvas and jspdf so their ~600 KB
// combined weight doesn't land in the initial bundle. They're only needed when
// the user explicitly triggers a PDF or PNG export.

export async function exportElementToPNG(el: HTMLElement, filename: string): Promise<void> {
  const html2canvas = (await import('html2canvas')).default
  const canvas = await html2canvas(el, {
    backgroundColor: '#FAF8F3',
    scale: 2,
    useCORS: true,
    logging: false,
  })
  const link = document.createElement('a')
  link.download = filename.endsWith('.png') ? filename : `${filename}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export async function exportElementToPDF(el: HTMLElement, filename: string): Promise<void> {
  const [html2canvas, { default: jsPDF }] = await Promise.all([
    import('html2canvas').then(m => m.default),
    import('jspdf'),
  ])
  const canvas = await html2canvas(el, {
    backgroundColor: '#FAF8F3',
    scale: 2,
    useCORS: true,
    logging: false,
  })
  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
  pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height)
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
