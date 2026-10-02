import { describe, it, expect, beforeEach } from 'vitest'
import { injectCSSVars } from './theme'
import type { AdminSettings } from '../types/api'

const mockSettings: AdminSettings = {
  title: 'openPIP', shortTitle: 'openPIP', footer: '', homePage: '',
  missionTitle: '', missionText: '', methodTitle: '', methodText: '',
  mainColorScheme: '#a51c30',
  headerColorScheme: '#ffffff',
  logoColorScheme: '#cccccc',
  buttonColorScheme: '#a51c30',
  queryNodeColor: '#cc0000',
  interactorNodeColor: '#3c78d8',
  publishedEdgeColor: '#38761d',
  validatedEdgeColor: '#1155cc',
  verifiedEdgeColor: '#cc0000',
  literatureEdgeColor: '#ff9900',
  url: '', version: '2.0',
  about: '', faq: '', contact: '', download: '',
  showTissueExpression: true,
  showSubcellularLocation: true,
  horizontalFilterBar: false,
  showDownloads: true, showDownloadAll: true,
  example1: '', example2: '', example3: '',
  example1Type: '', example2Type: '', example3Type: '',
}

describe('injectCSSVars', () => {
  beforeEach(() => { document.documentElement.style.cssText = '' })

  it('sets --color-main on :root', () => {
    injectCSSVars(mockSettings)
    expect(document.documentElement.style.getPropertyValue('--color-main')).toBe('#a51c30')
  })

  it('sets --color-logo on :root', () => {
    injectCSSVars(mockSettings)
    expect(document.documentElement.style.getPropertyValue('--color-logo')).toBe('#cccccc')
  })

  it('sets all 11 CSS variables', () => {
    injectCSSVars(mockSettings)
    const vars = [
      '--color-main', '--color-header', '--color-logo', '--color-button',
      '--color-query-node', '--color-interactor-node',
      '--color-edge-published', '--color-edge-validated',
      '--color-edge-verified', '--color-edge-literature', '--color-edge-mixed',
    ]
    for (const v of vars) {
      expect(document.documentElement.style.getPropertyValue(v)).toBeTruthy()
    }
  })
})
