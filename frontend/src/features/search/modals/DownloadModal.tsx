import { useState } from 'react'
import { Modal } from './Modal'
import { useSearchStore } from '../searchStore'
import {
  formatSIF,
  formatInteractionsCSV,
  formatInteractorsCSV,
  formatFASTA,
  formatPSIMI,
  buildFilename,
  downloadFile,
  downloadImageFile,
} from '../../../lib/download'
import { useCanvasBackground } from '../network/canvasBackground'

type Format = 'sif' | 'interactions_csv' | 'interactors_csv' | 'fasta' | 'psimi' | 'png' | 'jpg'

const FORMAT_LABELS: Record<Format, string> = {
  sif: 'SIF',
  interactions_csv: 'Interactions CSV',
  interactors_csv: 'Interactors CSV',
  fasta: 'FASTA',
  psimi: 'PSI-MI TAB',
  png: 'Network Image (PNG)',
  jpg: 'Network Image (JPG)',
}

const FORMAT_EXT: Record<Format, string> = {
  sif: 'sif',
  interactions_csv: 'csv',
  interactors_csv: 'csv',
  fasta: 'fasta',
  psimi: 'txt',
  png: 'png',
  jpg: 'jpg',
}

export function DownloadModal({ onClose }: { onClose: () => void }) {
  const { allProteins, allInteractions, networkCy, queryProteinIds } = useSearchStore()
  const [fmt, setFmt] = useState<Format>('sif')
  // The canvas's own color when one is set; white when it follows the theme.
  const background = useCanvasBackground() ?? undefined

  const handleDownload = () => {
    if (fmt === 'png' || fmt === 'jpg') {
      if (networkCy) downloadImageFile(networkCy, fmt, background)
      onClose()
      return
    }
    let content = ''
    if (fmt === 'sif') content = formatSIF(allInteractions, allProteins)
    else if (fmt === 'interactions_csv')
      content = formatInteractionsCSV(allInteractions, allProteins, new Set(queryProteinIds))
    else if (fmt === 'interactors_csv') content = formatInteractorsCSV(allProteins)
    else if (fmt === 'fasta') content = formatFASTA(allProteins)
    else if (fmt === 'psimi') content = formatPSIMI(allInteractions, allProteins)
    downloadFile(buildFilename(fmt, FORMAT_EXT[fmt]), content)
    onClose()
  }

  return (
    <Modal title="Download Data" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {(Object.keys(FORMAT_LABELS) as Format[]).map((f) => (
          <label key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
            <input
              type="radio"
              name="format"
              value={f}
              checked={fmt === f}
              onChange={() => setFmt(f)}
              style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            {FORMAT_LABELS[f]}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button onClick={onClose} className="op-btn" style={{ fontSize: 13 }}>
          Cancel
        </button>
        <button onClick={handleDownload} className="op-btn primary" style={{ fontSize: 13 }}>
          Download
        </button>
      </div>
    </Modal>
  )
}
