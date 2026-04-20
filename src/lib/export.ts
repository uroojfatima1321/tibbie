import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export async function exportElementToPNG(el: HTMLElement, filename: string): Promise<void> {
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
  const canvas = await html2canvas(el, {
    backgroundColor: '#FAF8F3',
    scale: 2,
    useCORS: true,
    logging: false,
  })
  const imgData = canvas.toDataURL('image/png')

  // Single landscape A4 page, scaled to fit — per US-21 and your default
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  // Fit-contain: preserve aspect, fit inside page
  const imgAspect = canvas.width / canvas.height
  const pageAspect = pageW / pageH
  let w = pageW, h = pageH
  if (imgAspect > pageAspect) {
    h = pageW / imgAspect
  } else {
    w = pageH * imgAspect
  }
  const x = (pageW - w) / 2
  const y = (pageH - h) / 2

  pdf.addImage(imgData, 'PNG', x, y, w, h)
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`)
}
