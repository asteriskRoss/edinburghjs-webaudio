'option strict';

import { HiHat } from './hi-hat.js';
import { KickDrum } from './kick-drum.js';
import { RiffSynth } from './riff-synth.js';

// Notes to frequencies
// https://chat.openai.com
// Prompt: List the frequencies in hz of all white notes on a piano keyboard formatted as a javascript object with notes as properties in the format A4: 440.000000
const Note = Object.freeze({
  A0: 27.5,
  B0: 30.867706,
  C1: 32.703195,
  D1: 36.708095,
  E1: 41.203444,
  F1: 43.653529,
  G1: 48.999429,
  A1: 55.0,
  B1: 61.735413,
  C2: 65.406391,
  D2: 73.416191,
  E2: 82.406889,
  F2: 87.307058,
  G2: 97.998859,
  A2: 110.0,
  B2: 123.470825,
  C3: 130.812783,
  D3: 146.832383,
  E3: 164.813778,
  F3: 174.614116,
  G3: 195.997718,
  A3: 220.0,
  B3: 246.941651,
  C4: 261.625565,
  D4: 293.664767,
  E4: 329.627557,
  F4: 349.228231,
  G4: 391.995436,
  A4: 440.0,
  B4: 493.883301,
  C5: 523.251131,
  D5: 587.329535,
  E5: 659.255114,
  F5: 698.456463,
  G5: 783.990872,
  A5: 880.0,
  B5: 987.766603,
  C6: 1046.502261,
  D6: 1174.659071,
  E6: 1318.510228,
  F6: 1396.912927,
  G6: 1567.981744,
  A6: 1760.0,
  B6: 1975.533205,
  C7: 2093.004523,
  D7: 2349.318143,
  E7: 2637.020455,
  F7: 2793.825854,
  G7: 3135.963488,
  A7: 3520.0,
  B7: 3951.06641,
  C8: 4186.009046
});

// Arrangements
// With inspiration from:
// YouTube @Bthelick
// How To Write Piano House like MK Woolford D.O.D Easy Method
// https://www.youtube.com/watch?v=j4PaQXJI6fk
//
const ARRANGEMENT_LENGTH = 32;
const ARRANGEMENT_INDEX_BEAT_COUNT = 4; // Number of entries in an arrangement that correspond to a crochet
// prettier-ignore
const ARRANGEMENT_KICK_DRUM = [
  true, false, false, false,
  true, false, false, false,
  true, false, false, false,
  true, false, false, false,

  true, false, false, false,
  true, false, false, false,
  true, false, false, false,
  true, false, true, false
];
// prettier-ignore
const ARRANGEMENT_HI_HAT = [
  false, false, true, false,
  false, false, true, false,
  false, false, true, false,
  false, false, true, false,

  false, false, true, false,
  false, false, true, false,
  false, false, true, false,
  false, false, true, false
];

// prettier-ignore
// eslint-disable-next-line no-sparse-arrays
const ARRANGEMENT_BASS = [
  Note.A2, , , ,
  , , , ,
  Note.A2, , , ,
  , , , ,

  Note.C3, , , ,
  , , , ,
  Note.F2, , , ,
  Note.G2, , , ,
];

// prettier-ignore
// eslint-disable-next-line no-sparse-arrays
const ARRANGEMENT_RIFF0 = [
  Note.G3, , Note.G3, ,
  , , , ,
  Note.G3, , Note.G3, ,
  , , , ,

	Note.G3, , Note.G3, ,
	, , , ,
	Note.G3, , Note.G3, ,
	, , , ,
];

// prettier-ignore
// eslint-disable-next-line no-sparse-arrays
const ARRANGEMENT_RIFF1 = [
  Note.B3, , Note.B3, ,
  , , , ,
  Note.B3, , Note.B3, ,
  , , , ,

  Note.C4, , Note.C4, ,
  , , , ,
  Note.C4, , Note.C4, ,
  , , , ,
];

// prettier-ignore
// eslint-disable-next-line no-sparse-arrays
const ARRANGEMENT_RIFF2 = [
  Note.C6, , , ,
  , , Note.A5, Note.C6,
  Note.A5, , , ,
  , , , ,

  Note.D6, , , ,
  Note.D6, , , ,
  Note.D6, , Note.A5, ,
  , , , ,
];

// Scheduling
const SCHEDULE_TIMEOUT = 25; // ms between scheduler calls
const SCHEDULE_AHEAD = 0.1; // Schedule notes due up to this many seconds ahead

export class HouseMusic {
  constructor() {
    // Sanity check arrangements (yes, in production code this would be in a unit test!)
    [
      ARRANGEMENT_KICK_DRUM,
      ARRANGEMENT_HI_HAT,
      ARRANGEMENT_RIFF0,
      ARRANGEMENT_RIFF1,
      ARRANGEMENT_RIFF2
    ].forEach((arrangement, index) => {
      console.assert(
        arrangement.length == ARRANGEMENT_LENGTH,
        `Warning: Arrangement ${index} is unexpected length.`
      );
    });

    const context = new AudioContext();

    // Flag indicating whether music is playing
    this.playing = false;

    // Flags for playing instruments
    this.playingKickDrum = true;
    this.playingHiHat = true;
    this.playingRiff0 = true;
    this.playingRiff1 = true;
    this.playingRiff2 = true;
    this.playingBass = true;

    // Beats per minute for playback
    this.bpm = 120.0;

    // Index of where in the arrangement is to be played next
    this.arrangementIndex = 0;

    // Time at which the next part of the arrangement is to be played
    this.arrangementTime = 0.0;

    // Create audio graph
    // instruments -- individual gains -- speakers

    // Riff synths used for chords
    const riffSynthCount = 3;

    // Gain nodes for instruments
    const hiHatGain = context.createGain();
    hiHatGain.gain.value = 0.1;
    hiHatGain.connect(context.destination);

    const kickDrumGain = context.createGain();
    kickDrumGain.gain.value = 0.5;
    kickDrumGain.connect(context.destination);

    const bassSynthGain = context.createGain();
    bassSynthGain.gain.value = 0.05;
    bassSynthGain.connect(context.destination);

    const riffSynthGains = [];
    for (let i = 0; i < riffSynthCount; i++) {
      const g = context.createGain();
      g.gain.value = 0.15 / riffSynthCount;
      g.connect(context.destination);
      riffSynthGains[i] = g;
    }

    // Instruments
    const hiHat = new HiHat(context, hiHatGain);
    const kickDrum = new KickDrum(context, kickDrumGain);
    const riffSynths = [];
    for (let i = 0; i < riffSynthCount; i++) {
      riffSynths[i] = new RiffSynth(context, riffSynthGains[i]);
    }

    // Use RiffSynth with slightly tweaked parameters for a.bassline
    const bassSynth = new RiffSynth(context, bassSynthGain);
    bassSynth.wave = 'square';
    bassSynth.adsr.attack = 0.04;
    bassSynth.adsr.decay = 0.6;
    bassSynth.adsr.sustain = 0.3;
    bassSynth.adsr.release = 0.4;

    // Save references
    this.context = context;
    this.hiHat = hiHat;
    this.kickDrum = kickDrum;
    this.riff0 = riffSynths[0];
    this.riff1 = riffSynths[1];
    this.riff2 = riffSynths[2];
    this.bass = bassSynth;
  }

  nextArrangement() {
    this.arrangementIndex = (this.arrangementIndex + 1) % ARRANGEMENT_LENGTH;

    const timeToNextArrangementIndex =
      60.0 / (ARRANGEMENT_INDEX_BEAT_COUNT * this.bpm);
    this.arrangementTime = this.arrangementTime + timeToNextArrangementIndex;
  }

  // Scheduling notes allows for realtime changes in what is playing.
  // The approach I've used here is based on the MDN tutorial here: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques
  // The tutorial references this article as its own reference:
  // Chris Wilson's A Tale Of Two Clocks (2013) https://web.dev/audio-scheduling/
  static schedule(houseMusic) {
    // Stop scheduling if we're stopped
    if (!houseMusic.playing) return;

    // Schedule the next sounds to play from the arrangement
    while (
      houseMusic.arrangementTime <=
      houseMusic.context.currentTime + SCHEDULE_AHEAD
    ) {
      // Schedule the next sounds. In production code I would make this a bit
      // neater by having some kind of Instrument class that provided a consistent
      // interface such that all instruments could be scheduled in a DRY for loop
      if (
        houseMusic.playingKickDrum &&
        ARRANGEMENT_KICK_DRUM[houseMusic.arrangementIndex]
      ) {
        houseMusic.kickDrum.play(houseMusic.arrangementTime);
        console.log(`Playing kick drum: ${houseMusic.arrangementIndex}`);
      }

      if (
        houseMusic.playingHiHat &&
        ARRANGEMENT_HI_HAT[houseMusic.arrangementIndex]
      ) {
        houseMusic.hiHat.play(houseMusic.arrangementTime);
        console.log(`Playing hihat: ${houseMusic.arrangementIndex}`);
      }

      if (houseMusic.playingRiff0) {
        const note = ARRANGEMENT_RIFF0[houseMusic.arrangementIndex];
        if (note) {
          console.log(`Playing riff0: ${houseMusic.arrangementIndex} ${note}`);
          houseMusic.riff0.play(houseMusic.arrangementTime, note);
        }
      }

      if (houseMusic.playingRiff1) {
        const note = ARRANGEMENT_RIFF1[houseMusic.arrangementIndex];
        if (note) {
          console.log(`Playing riff1: ${houseMusic.arrangementIndex} ${note}`);
          houseMusic.riff0.play(houseMusic.arrangementTime, note);
        }
      }

      if (houseMusic.playingRiff2) {
        const note = ARRANGEMENT_RIFF2[houseMusic.arrangementIndex];
        if (note) {
          console.log(`Playing riff2: ${houseMusic.arrangementIndex} ${note}`);
          houseMusic.riff0.play(houseMusic.arrangementTime, note);
        }
      }

      if (houseMusic.playingBass) {
        const note = ARRANGEMENT_BASS[houseMusic.arrangementIndex];
        if (note) {
          console.log(`Playing bass: ${houseMusic.arrangementIndex} ${note}`);
          houseMusic.bass.play(houseMusic.arrangementTime, note);
        }
      }

      // Move on to the next part of the arrangment
      houseMusic.nextArrangement();
    }

    // Call this function again shortly as we expect to schedule to allow for unreliable JS clock
    setTimeout(() => HouseMusic.schedule(houseMusic), SCHEDULE_TIMEOUT);
  }

  start() {
    if (!this.playing) {
      this.arrangementIndex = 0;
      this.arrangementTime = this.context.currentTime;
      this.playing = true;
      HouseMusic.schedule(this);
    } else {
      console.log('House music already playing.');
    }
  }

  stop() {
    this.playing = false;
  }
}
