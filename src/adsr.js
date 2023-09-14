'option strict';

/// Holds data about Attack Decay Sustain Release curves
/// See https://stickz.co/blog/adsr-explained-sound-design-basics/
export class Adsr {
  constructor(attack, decay, sustain, release) {
    this.attack = attack;
    this.decay = decay;
    this.sustain = sustain;
    this.release = release;
  }

  /// Length in seconds of the curve
  duration() {
    return this.attack + this.decay + this.release;
  }

  /// Apply the values to the audio parameter
  static apply(adsr, context, fromTime, audioParam, minValue, maxValue) {
    fromTime = Math.max(fromTime, context.currentTime);

    // Start at minValue
    audioParam.setValueAtTime(minValue, fromTime);

    // Raise to maxValue in Attack phase
    audioParam.linearRampToValueAtTime(maxValue, fromTime + adsr.attack);

    // Reduce to sustain value in Decay phase
    audioParam.linearRampToValueAtTime(
      adsr.sustain,
      fromTime + adsr.attack + adsr.decay
    );

    // Reduce to minValue in Release phase
    if (minValue == 0.0) {
      // Web Audio API doesn't like zero
      audioParam.exponentialRampToValueAtTime(0.01, fromTime + adsr.duration());
      audioParam.setValueAtTime(minValue, fromTime + adsr.duration());
    } else {
      audioParam.setValueAtTime(minValue, fromTime + adsr.duration());
    }
  }
}
