class AudioManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private isMuted: boolean = false;

  // Background Ambient Drone elements
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  // Sequencer background music loop elements
  private musicInterval: any = null;
  private sequencerStep: number = 0;

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Proactively spawn background audio if not muted
      if (!this.isMuted) {
        this.startAmbientDrone();
        this.startMusicLoop();
      }
    } catch (e) {
      console.warn("AudioContext is not supported in this browser.", e);
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopEngine();
      this.stopAmbientDrone();
      this.stopMusicLoop();
    } else {
      this.init();
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      this.startAmbientDrone();
      this.startMusicLoop();
    }
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  public playClick() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }

  public playBetPlaced() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Clean double chime: clear pitch dropping for perfect placement confirmation state feedback
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now); // Core high A
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch (e) {}
  }

  // SOUND 1 : Ambient space hum
  public startAmbientDrone() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.stopAmbientDrone();

    try {
      this.droneOsc1 = this.ctx.createOscillator();
      this.droneOsc2 = this.ctx.createOscillator();
      this.droneGain = this.ctx.createGain();

      this.droneOsc1.type = "sine";
      this.droneOsc1.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A

      this.droneOsc2.type = "triangle";
      this.droneOsc2.frequency.setValueAtTime(55.4, this.ctx.currentTime); // Detuned for fat chorus

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(100, this.ctx.currentTime);

      // Low volume to act as ambient space baseline hum
      this.droneGain.gain.setValueAtTime(0.045, this.ctx.currentTime);

      this.droneOsc1.connect(filter);
      this.droneOsc2.connect(filter);
      filter.connect(this.droneGain);
      this.droneGain.connect(this.ctx.destination);

      this.droneOsc1.start();
      this.droneOsc2.start();
    } catch (e) {
      console.warn("Could not start ambient space hum drone", e);
    }
  }

  public stopAmbientDrone() {
    if (this.droneOsc1) {
      try { this.droneOsc1.stop(); this.droneOsc1.disconnect(); } catch (e) {}
      this.droneOsc1 = null;
    }
    if (this.droneOsc2) {
      try { this.droneOsc2.stop(); this.droneOsc2.disconnect(); } catch (e) {}
      this.droneOsc2 = null;
    }
    if (this.droneGain) {
      try { this.droneGain.disconnect(); } catch (e) {}
      this.droneGain = null;
    }
  }

  // SOUND 6 : Background electronic tense beat loop
  public startMusicLoop() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    this.stopMusicLoop();

    this.sequencerStep = 0;
    const stepTime = 160; // Sixteen-note step duration in ms (tempo ~94BPM)

    this.musicInterval = setInterval(() => {
      if (!this.ctx || this.isMuted) return;
      if (this.ctx.state === "suspended") return;

      const now = this.ctx.currentTime;
      const step = this.sequencerStep;
      this.sequencerStep = (this.sequencerStep + 1) % 8;

      // 1. Synthesizer Bassline (Tense, dynamic motif progression)
      // A1 (55Hz), C2 (65.4Hz), E1 (41.2Hz), G1 (49Hz)
      const bassSequence = [55, 55, 65.4, 55, 49, 49, 41.2, 55];
      const frequency = bassSequence[step];

      if (step % 2 === 0) {
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(frequency, now);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(140, now);

          gain.gain.setValueAtTime(0.018, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.15);
        } catch (e) {}
      }

      // 2. Synthesized Kick Drum (Deep punch on beat 1 and 5)
      if (step === 0 || step === 4) {
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(130, now);
          osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

          gain.gain.setValueAtTime(0.05, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);

          osc.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.14);
        } catch (e) {}
      }

      // 3. Synthesized Hi-Hat (crisp hiss ticks on offbeats 2, 4, 6, 8)
      if (step % 2 === 1) {
        try {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();

          osc.type = "triangle";
          osc.frequency.setValueAtTime(9000 + Math.random() * 2000, now);

          filter.type = "highpass";
          filter.frequency.setValueAtTime(6500, now);

          gain.gain.setValueAtTime(0.008, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);

          osc.start(now);
          osc.stop(now + 0.06);
        } catch (e) {}
      }
    }, stepTime);
  }

  public stopMusicLoop() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }

  // SOUND 2 : Rocket engine rumble (pitch and volume rises with multiplier value)
  public startEngine() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    this.stopEngine();

    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();

      this.engineOsc.type = "sawtooth";
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime); // Deep rumbling baseline (45Hz)

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(140, this.ctx.currentTime);
      filter.Q.setValueAtTime(4, this.ctx.currentTime); // resonance peaks the roar details

      this.engineGain.gain.setValueAtTime(0.035, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);

      this.engineOsc.start();
    } catch (e) {
      console.error("Failed to start engine audio", e);
    }
  }

  // SOUND 2.1 : Premium Jet Takeoff / Afterburner exhaust boom with compressor whining
  public playJetTakeoff() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    try {
      const now = this.ctx.currentTime;

      // 1. High Velocity Noise Block simulating massive gas expansion
      const bufferSize = this.ctx.sampleRate * 2.2; 
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.setValueAtTime(280, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(1500, now + 1.1);
      noiseFilter.Q.setValueAtTime(2.5, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.01, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.50, now + 0.3); // Quick massive fuel ignition!
      noiseGain.gain.exponentialRampToValueAtTime(0.14, now + 1.4); // Sustain
      noiseGain.gain.linearRampToValueAtTime(0.001, now + 2.1); // Smooth decay

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);

      // 2. High frequency turbine whining compressor
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(2200, now + 1.1);

      oscGain.gain.setValueAtTime(0.001, now);
      oscGain.gain.exponentialRampToValueAtTime(0.20, now + 0.35); // Dramatic turbine wind up
      oscGain.gain.exponentialRampToValueAtTime(0.04, now + 1.3);
      oscGain.gain.linearRampToValueAtTime(0.001, now + 1.9);

      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 2.0);

      // 3. Low frequency sub-woofer rumbling afterburner thruster
      const lowOsc = this.ctx.createOscillator();
      const lowGain = this.ctx.createGain();
      lowOsc.type = "sawtooth";
      lowOsc.frequency.setValueAtTime(55, now);
      lowOsc.frequency.linearRampToValueAtTime(100, now + 1.4);

      const lowFilter = this.ctx.createBiquadFilter();
      lowFilter.type = "lowpass";
      lowFilter.frequency.setValueAtTime(110, now);

      lowGain.gain.setValueAtTime(0.001, now);
      lowGain.gain.exponentialRampToValueAtTime(0.40, now + 0.25);
      lowGain.gain.exponentialRampToValueAtTime(0.06, now + 1.4);
      lowGain.gain.linearRampToValueAtTime(0.001, now + 1.9);

      lowOsc.connect(lowFilter);
      lowFilter.connect(lowGain);
      lowGain.connect(this.ctx.destination);
      lowOsc.start(now);
      lowOsc.stop(now + 2.0);

    } catch (e) {
      console.warn("Could not play jet takeoff turbine audio:", e);
    }
  }

  public updateEngine(multiplier: number) {
    if (!this.ctx || this.isMuted || !this.engineOsc || !this.engineGain) return;

    // Pitch rises dynamically as multiplier increases
    const targetFreq = 45 + Math.min(multiplier * 18, 450);
    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.15);

    // Rumble intensity increases as flight path scales up
    const targetGain = 0.035 + Math.min(multiplier * 0.012, 0.10);
    this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.12);
  }

  public stopEngine() {
    if (this.engineOsc) {
      try {
        this.engineOsc.stop();
        this.engineOsc.disconnect();
      } catch (e) {}
      this.engineOsc = null;
    }
    if (this.engineGain) {
      try {
        this.engineGain.disconnect();
      } catch (e) {}
      this.engineGain = null;
    }
  }

  // SOUND 3 : Ascending beautiful cashout chime/ding
  public playCashOut() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    const playTone = (freq: number, start: number, duration: number) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    };

    // Upward lush arpeggio chime representing luxurious success
    playTone(523.25, now, 0.22); // C5
    playTone(659.25, now + 0.08, 0.22); // E5
    playTone(783.99, now + 0.16, 0.22); // G5
    playTone(1046.50, now + 0.24, 0.45); // C6
  }

  // SOUND 4 : CRASH Explosion (dramatic boom + descending tone)
  public playFlewAway() {
    this.init();
    if (!this.ctx || this.isMuted) return;
    this.stopEngine();

    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    // High Impact Boom + Pitch Sweep Descender
    try {
      const now = this.ctx.currentTime;

      // 1. White noise boom explosion
      const bufferSize = this.ctx.sampleRate * 1.8; // 1.8 seconds explosion
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.setValueAtTime(600, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(10, now + 1.6);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.35, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      noiseNode.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noiseNode.start(now);

      // 2. Heavy low frequency swept tone (descending boom chord)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(25, now + 1.1);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(180, now);

      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.3);

    } catch (e) {
      // Fallback simple bass sweep if AudioBuffer triggers node blocks
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(40, this.ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
      } catch (err) {}
    }
  }
}

export const audioManager = new AudioManager();
