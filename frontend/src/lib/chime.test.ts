import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

describe('chime', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function loadWithFakeAudio() {
    const started: number[] = []
    class FakeCtx {
      currentTime = 0
      destination = {}
      createOscillator() {
        return {
          type: '',
          frequency: { value: 0 },
          connect: () => ({ connect: () => {} }),
          start: (t: number) => started.push(t),
          stop: () => {},
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          connect: () => {},
        }
      }
      close() {}
    }
    vi.stubGlobal('AudioContext', FakeCtx)
    const chime = await import('./chime')
    return { chime, started }
  }

  it('plays two notes, then stays quiet until the gap has passed', async () => {
    const { chime, started } = await loadWithFakeAudio()
    chime.playChime()
    expect(started).toHaveLength(2)

    // A comment raises a notification too; the second call is the same event.
    chime.playChime()
    expect(started).toHaveLength(2)
  })

  it('plays nothing when the sound is switched off', async () => {
    const { chime, started } = await loadWithFakeAudio()
    chime.setChimeMuted(true)
    expect(chime.chimeMuted()).toBe(true)
    chime.playChime()
    expect(started).toHaveLength(0)
  })

  it('is silent, not broken, where there is no audio', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const chime = await import('./chime')
    expect(() => chime.playChime()).not.toThrow()
  })
})
