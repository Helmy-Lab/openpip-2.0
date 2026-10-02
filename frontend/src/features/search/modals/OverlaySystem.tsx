import { useSearchStore } from '../searchStore'
import { CyRestModal } from './CyRestModal'
import { DirectDownloadModal } from './DirectDownloadModal'

export function OverlaySystem() {
  const { activeModal, setModal } = useSearchStore()
  const close = () => setModal(null)

  if (activeModal === 'cyRest') return <CyRestModal onClose={close} />
  if (activeModal === 'directDownload') return <DirectDownloadModal onClose={close} />
  return null
}
