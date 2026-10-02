/**
 * A short two-note blip for something arriving — a share, or a reply in a
 * discussion. Synthesised rather than a bundled sound file: it is two
 * oscillators, and an asset would be a download for half a second of audio.
 */
const KEY = 'openpip_notify_sound'
/** A comment in an open discussion also raises a notification; one chime. */
const GAP_MS = 3000

let lastPlayed = 0

export function chimeMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
}

export function setChimeMuted(muted: boolean): void {
  try {
    localStorage.setItem(KEY, muted ? 'off' : 'on')
  } catch {
    // A browser refusing storage is not a reason to fail a notification.
  }
}

export function playChime(): void {
  if (chimeMuted()) return
  const now = Date.now()
  if (now - lastPlayed < GAP_MS) return
  lastPlayed = now

  const Ctx = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return
  try {
    const ctx = new Ctx()
    // Two rising notes, quiet, each fading out so neither clicks off.
    ;[
      { freq: 660, at: 0 },
      { freq: 880, at: 0.12 },
    ].forEach(({ freq, at }) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + at + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.2)
    })
    setTimeout(() => ctx.close(), 600)
  } catch {
    // Autoplay policy, or no audio device. Nothing to recover from.
  }
}
