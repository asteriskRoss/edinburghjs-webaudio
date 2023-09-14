'option strict';
import { Adsr } from './adsr.js';

export class HiHat {
  constructor(audioContext, audioDestination) {
    // References
    this.context = audioContext;
    this.destination = audioDestination;

    // White noise buffer
    this.buffer = HiHat.buildBuffer(audioContext);

    // Bandpass filter
    this.filter = new BiquadFilterNode(audioContext, {
      type: 'bandpass',
      Q: 20.0,
      frequency: 10000.0
    });

    // ADSR (attack, decay, sustain, release) envelope for amplitude
    this.adsr = new Adsr(0, 0.2, 0.2, 0.1);
  }

  // Create a buffer and fill it with white noise
  static buildBuffer(context) {
    const numberOfChannels = 1;
    const lengthInSeconds = 1; // One second is more than enough for our hi-hat
    const sampleRate = context.sampleRate;
    const lengthOfBuffer = lengthInSeconds * sampleRate;

    // Create the buffer
    const buffer = context.createBuffer(
      numberOfChannels,
      lengthOfBuffer,
      sampleRate
    );

    // Fill the buffer with a random values to give us white noise
    const arrayBuffer = buffer.getChannelData(0);

    for (let i = 0; i < lengthOfBuffer; i++) {
      arrayBuffer[i] = Math.random() * 2.0 - 1.0;
    }

    return buffer;
  }

  // Play the hi-hat!
  play(fromTime = this.context.currentTime) {
    fromTime = Math.max(fromTime, this.context.currentTime);

    const gainNode = this.context.createGain();
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = true;

    source.connect(this.filter);
    this.filter.connect(gainNode);
    gainNode.connect(this.destination);

    // Control the drum sound with an ADSR envelope on the gain
    // See https://stickz.co/blog/adsr-explained-sound-design-basics/
    Adsr.apply(this.adsr, this.context, fromTime, gainNode.gain, 0, 1);

    // Start our oscillator
    source.start();
    source.stop(fromTime + this.adsr.duration());

    // Disconnect our gain node when we're done so it will be garbage collected
    source.onended = () => {
      this.filter.disconnect(gainNode);
      gainNode.disconnect();
    };
  }
}
