import { useState, useRef } from 'react'
import { Download, Image, Copy, ChevronDown, X } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { useApp } from '../../store/context'
import type { ProjectV2 } from '../../types'

interface Props {
  portfolios: { name: string; projects: ProjectV2[] }[]
}

export function ExportButton({ portfolios }: Props) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [status, setStatus] = useState('')
  const { pushToast } = useApp()

  async function captureRoot(): Promise<HTMLCanvasElement | null> {
    const el = document.getElementById('tibbie-export-root')
    if (!el) return null
    // Temporarily make visible for capture
    const prev = el.style.left
    el.style.left = '0'
    el.style.position = 'fixed'
    el.style.zIndex = '9999'
    el.style.top = '0'
    await new Promise(r => setTimeout(r, 100)) // Let fonts render
    const canvas = await html2canvas(el, { backgroundColor: '#FFFFFF', scale: 2, useCORS: true, logging: false })
    el.style.left = prev
    el.style.position = 'absolute'
    el.style.zIndex = '-1'
    el.style.top = '0'
    return canvas
  }

  async function handlePNG() {
    setExporting(true)
    try {
      for (let i = 0; i < portfolios.length; i++) {
        setStatus(`Capturing ${portfolios[i].name}…`)
        const canvas = await captureRoot()
        if (!canvas) { pushToast('error', 'Export element not found'); return }
        const link = document.createElement('a')
        const slug = portfolios[i].name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
        link.download = `tibbie-${slug}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
        await new Promise(r => setTimeout(r, 300))
      }
      pushToast('success', `Exported ${portfolios.length} PNG${portfolios.length > 1 ? 's' : ''}`)
      setOpen(false)
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Export failed')
    } finally { setExporting(false); setStatus('') }
  }

  async function handlePDF() {
    setExporting(true)
    setStatus('Building PDF…')
    try {
      const canvas = await captureRoot()
      if (!canvas) { pushToast('error', 'Export element not found'); return }
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      // Scale to fit one page (single-pass — for multi-portfolio, the hidden layout renders all)
      const ratio = Math.min(pageW / (canvas.width / 2), pageH / (canvas.height / 2))
      const w = (canvas.width / 2) * ratio, h = (canvas.height / 2) * ratio
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageW - w) / 2, (pageH - h) / 2, w, h)
      pdf.save(`tibbie-roadmap-${new Date().toISOString().slice(0, 10)}.pdf`)
      pushToast('success', 'Exported PDF')
      setOpen(false)
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Export failed')
    } finally { setExporting(false); setStatus('') }
  }

  async function handleCopy() {
    setExporting(true)
    setStatus('Copying image…')
    try {
      const canvas = await captureRoot()
      if (!canvas) { pushToast('error', 'Export element not found'); return }
      canvas.toBlob(async blob => {
        if (!blob) return
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
          pushToast('success', 'Copied to clipboard')
        } catch {
          pushToast('error', 'Clipboard write failed — try PNG download instead')
        }
      })
      setOpen(false)
    } catch (e) {
      pushToast('error', e instanceof Error ? e.message : 'Export failed')
    } finally { setExporting(false); setStatus('') }
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="btn-outline flex items-center gap-1.5 !py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust-200"
        aria-label="Export roadmap"
      >
        <Download size={14} />
        Export
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !exporting && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-surface-200 rounded-xl shadow-float z-30 py-1 animate-scale-in">
          <button onClick={handlePNG} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-surface-50 transition-colors">
            <Image size={14} className="text-ink-400" />
            <div className="text-left">
              <div className="font-medium">PNG per portfolio</div>
              <div className="text-[11px] text-ink-400">One image per section</div>
            </div>
          </button>
          <button onClick={handlePDF} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-surface-50 transition-colors">
            <Download size={14} className="text-ink-400" />
            <div className="text-left">
              <div className="font-medium">PDF — full roadmap</div>
              <div className="text-[11px] text-ink-400">All portfolios, landscape A4</div>
            </div>
          </button>
          <button onClick={handleCopy} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-700 hover:bg-surface-50 transition-colors">
            <Copy size={14} className="text-ink-400" />
            <div className="text-left">
              <div className="font-medium">Copy as image</div>
              <div className="text-[11px] text-ink-400">To clipboard</div>
            </div>
          </button>
        </div>
      )}

      {open && exporting && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-surface-200 rounded-xl shadow-float z-30 p-4 text-center animate-fade-in">
          <div className="text-sm text-ink-600">{status || 'Exporting…'}</div>
          <div className="mt-2 h-1 bg-surface-100 rounded-full overflow-hidden">
            <div className="h-full bg-rust-500 animate-pulse w-2/3" />
          </div>
        </div>
      )}
    </div>
  )
}
