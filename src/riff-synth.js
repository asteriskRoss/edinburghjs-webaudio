'option strict';
import { Adsr } from './adsr.js';

export class RiffSynth {
  constructor(audioContext, audioDestination) {
    // References
    this.context = audioContext;
    this.destination = audioDestination;

    // Set properties to defaults
    // Base oscillator frequency
    this.frequency = 440.0;

    // Oscillator waveform
    this.wave = 'triangle';

    // ADSR (attack, decay, sustain, release) envelope for amplitude
    this.adsr = new Adsr(0.1, 0.3, 0.6, 1);
  }

  // Play the synth!
  play(fromTime = this.context.currentTime, frequency = this.frequency) {
    fromTime = Math.max(fromTime, this.context.currentTime);

    const adsrGain = this.context.createGain();
    adsrGain.connect(this.destination);

    // Configure eight oscillators in harmony
    for (let i = 0; i < 8; i++) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();

      osc.type = this.wave;
      osc.frequency.value = frequency * (i + 1);

      // Each higher pitch will have a lower gain
      //gain.gain.value = 1.0/8;
      gain.gain.value = 1 / Math.pow(2, i + 1);

      osc.connect(gain);
      gain.connect(adsrGain);

      if (i == 0) {
        // Tidy up ADSR gain node
        osc.addEventListener('ended', () => adsrGain.disconnect());
      }

      // Tidy up once the oscillators are done
      osc.addEventListener('ended', () => gain.disconnect());

      osc.start(fromTime);
      osc.stop(fromTime + this.adsr.duration());
    }

    // Control the synth sound with an ADSR envelope on the gain
    // See https://stickz.co/blog/adsr-explained-sound-design-basics/
    Adsr.apply(this.adsr, this.context, fromTime, adsrGain.gain, 0, 1);
  }
}
