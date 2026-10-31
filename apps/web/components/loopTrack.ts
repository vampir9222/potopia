"use client";

import { onTimeStop } from "@app/ui";

/**
 * Musique qui boucle sans le moindre blanc : décodée une fois, puis rejouée par Web Audio entre
 * deux points précis (un lecteur `<audio loop>` laisse un petit trou à chaque tour avec un MP3).
 */
export class LoopTrack {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: Promise<AudioBuffer> | null = null;
  // un arrêt pendant le décodage annule la lecture demandée avant
  private token = 0;

  constructor(
    private readonly url: string,
    /** Début et fin de la boucle, en secondes dans le fichier. */
    private readonly loopStart: number,
    private readonly loopEnd: number,
  ) {}

  // arrêt du temps (ZA WARUDO) : la musique se fige puis reprend où elle en était
  private readonly offTimeStop = onTimeStop((stopped) => {
    if (stopped) void this.ctx?.suspend();
    else void this.ctx?.resume();
  });

  async play(volume: number): Promise<void> {
    this.stop();
    const token = this.token;
    this.ctx ??= new AudioContext();
    this.gain ??= this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.gain.gain.value = volume;
    this.buffer ??= fetch(this.url)
      .then((r) => r.arrayBuffer())
      .then((b) => (this.ctx as AudioContext).decodeAudioData(b));
    const buffer = await this.buffer;
    if (token !== this.token) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = this.loopStart;
    source.loopEnd = this.loopEnd;
    source.connect(this.gain);
    source.start(0, this.loopStart);
    this.source = source;
  }

  setVolume(volume: number): void {
    if (this.gain) this.gain.gain.value = volume;
  }

  stop(): void {
    this.token += 1;
    this.source?.stop();
    this.source?.disconnect();
    this.source = null;
  }
}
