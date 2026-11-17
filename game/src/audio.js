// Synthesized sound for Azura Bay: every effect and the music loop are built with
// the Web Audio API at runtime. No audio files are shipped, so the game loads
// nothing over the network.
// SPDX-License-Identifier: MIT

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOscA = null;
    this.sirenOscB = null;
    this.sirenGain = null;
    this.sirenOn = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch { /* audio is cosmetic; never break the game */ }
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const gain = this.ctx.createGain();
      gain.gain.value = vol || 0.3;
      if (lowpass) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass;
        src.connect(filter);
        filter.connect(gain);
      } else {
        src.connect(gain);
      }
      gain.connect(this.master);
      src.start(t);
    } catch { /* cosmetic */ }
  }

  shoot() {
    this.noise(0.12, 0.5, 2400);
    this.tone(180, 0.08, 'square', 0.12, 60);
  }

  enemyShoot() {
    this.noise(0.1, 0.25, 1800);
  }

  crash() {
    this.noise(0.25, 0.5, 700);
    this.tone(90, 0.25, 'sawtooth', 0.2, 40);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.22);
    setTimeout(() => this.tone(990, 0.14, 'sine', 0.22), 80);
  }

  cash() {
    this.tone(880, 0.08, 'triangle', 0.2);
    setTimeout(() => this.tone(1174, 0.08, 'triangle', 0.2), 70);
    setTimeout(() => this.tone(1568, 0.16, 'triangle', 0.2), 140);
  }

  missionDone() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.22, 'triangle', 0.22), i * 110));
  }

  wantedUp() {
    this.tone(440, 0.15, 'square', 0.14, 620);
    setTimeout(() => this.tone(620, 0.2, 'square', 0.14, 440), 140);
  }

  door() {
    this.noise(0.08, 0.2, 1200);
  }

  engineStart(speed01) {
    if (!this.ctx || this.muted) return;
    try {
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0.0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 600;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      const t = this.ctx.currentTime;
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, t, 0.08);
      this.engineGain.gain.setTargetAtTime(0.05 + speed01 * 0.05, t, 0.1);
    } catch { /* cosmetic */ }
  }

  engineStop() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  siren(on) {
    if (!this.ctx) return;
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    try {
      if (on) {
        if (!this.sirenOscA) {
          this.sirenOscA = this.ctx.createOscillator();
          this.sirenOscB = this.ctx.createOscillator();
          this.sirenGain = this.ctx.createGain();
          this.sirenGain.gain.value = 0.0;
          this.sirenOscA.type = 'sine';
          this.sirenOscB.type = 'sine';
          this.sirenOscA.frequency.value = 720;
          this.sirenOscB.frequency.value = 960;
          this.sirenOscA.connect(this.sirenGain);
          this.sirenOscB.connect(this.sirenGain);
          this.sirenGain.connect(this.master);
          this.sirenOscA.start();
          this.sirenOscB.start();
        }
        this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.2);
        let high = true;
        const flip = () => {
          if (!this.sirenOn) return;
          high = !high;
          if (this.sirenOscA) {
            this.sirenOscA.frequency.value = high ? 720 : 540;
            this.sirenOscB.frequency.value = high ? 960 : 720;
          }
          setTimeout(flip, 450);
        };
        setTimeout(flip, 450);
      } else if (this.sirenGain) {
        this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      }
    } catch { /* cosmetic */ }
  }

  // A lazy sunset groove: bass root notes with a soft pluck on top, scheduled in
  // eighth-note steps so it keeps time without a big sequencer.
  startMusic() {
    if (this.musicTimer || !this.ctx) return;
    const bassLine = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 0, 65.4, 0];
    const pluckLine = [220, 0, 262, 0, 330, 0, 262, 0, 220, 0, 294, 0, 330, 0, 392, 0];
    this.musicTimer = setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      const i = this.musicStep % 16;
      const bass = bassLine[i];
      const pluck = pluckLine[i];
      if (bass) this.tone(bass, 0.32, 'triangle', 0.11);
      if (pluck && this.musicStep % 2 === 0) this.tone(pluck, 0.18, 'sine', 0.05);
      this.musicStep++;
    }, 230);
  }
}
