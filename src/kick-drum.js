'option strict';
import { Adsr } from './adsr.js';

export class KickDrum {
  constructor(audioContext, audioDestination) {
    // References
    this.context = audioContext;
    this.destination = audioDestination;

    // Set properties to defaults
    // Starting oscillator frequency
    this.frequency = 100.0;

    // ADSR (attack, decay, sustain, release) envelope for amplitude
    this.adsr = new Adsr(0.01, 0.2, 0.8, 0.2);
  }

  // Play the drum!
  play(fromTime = this.context.currentTime) {
    fromTime = Math.max(fromTime, this.context.currentTime);
    const osc = this.context.createOscillator();
    const gainNode = this.context.createGain();

    osc.frequency.setValueAtTime(this.frequency, fromTime);

    // Lower frequency rapidly
    osc.frequency.exponentialRampToValueAtTime(
      this.frequency / 8,
      fromTime + this.adsr.duration()
    );

    osc.connect(gainNode);
    gainNode.connect(this.destination);

    // Control the drum sound with an ADSR envelope on the gain
    // See https://stickz.co/blog/adsr-explained-sound-design-basics/
    Adsr.apply(this.adsr, this.context, fromTime, gainNode.gain, 0, 1);

    // Start our oscillator
    osc.start(fromTime);
    osc.stop(fromTime + this.adsr.duration());

    // Disconnect our gain node when we're done so it will be garbage collected
    osc.onended = () => gainNode.disconnect();
  }
}
