class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Load mute state
    this.isMuted = localStorage.getItem('capsa_sfx_muted') === 'true';
  }

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('capsa_sfx_muted', String(muted));
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playCard() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Card play is a quick friction sound + tap
    // Tap: brief sine wave falling quickly
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.linearRampToValueAtTime(0.01, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);

    // Friction: filtered noise
    const bufferSize = ctx.sampleRate * 0.05; // 50ms noise
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.Q.setValueAtTime(3, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, now);
    noiseGain.gain.linearRampToValueAtTime(0.01, now + 0.05);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.05);
  }

  public playPass() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Swoosh sound using noise with sweeping filter
    const bufferSize = ctx.sampleRate * 0.15; // 150ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.15);
  }

  public playDeal() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Light high click
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playTick() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Short dry tick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.02);
  }

  public playWin() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Happy major arpeggio
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
    notes.forEach((freq, index) => {
      const startTime = now + index * 0.08;
      const duration = 0.3;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  public playLose() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // Melancholy descending minor chord
    const notes = [392.00, 349.23, 311.13, 261.63]; // G4, F4, Eb4, C4
    notes.forEach((freq, index) => {
      const startTime = now + index * 0.12;
      const duration = 0.4;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }

  public playFinish() {
    if (this.isMuted) return;
    const ctx = this.initCtx();
    const now = ctx.currentTime;

    // A fast, bright ascending chime (G5 -> C6 -> E6 -> G6)
    const notes = [783.99, 1046.50, 1318.51, 1567.98]; // G5, C6, E6, G6
    notes.forEach((freq, index) => {
      const startTime = now + index * 0.05;
      const duration = 0.25;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Add simple vibrato to the final note
      if (index === notes.length - 1) {
        osc.frequency.linearRampToValueAtTime(freq + 15, startTime + 0.05);
        osc.frequency.linearRampToValueAtTime(freq - 15, startTime + 0.1);
        osc.frequency.linearRampToValueAtTime(freq, startTime + 0.15);
      }

      gain.gain.setValueAtTime(0.12, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  }
}

export const sfx = new SoundSynthesizer();
