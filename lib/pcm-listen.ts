/**
 * Plays the live-call audio stream that Bland's listen WebSocket sends:
 * raw PCM, signed 16-bit little-endian, 16 kHz, mono, in binary frames.
 *
 * Browser-only. Schedules each incoming chunk back-to-back on a Web Audio
 * clock with a small lead so playback stays smooth; if the network stalls
 * and the schedule falls behind real time, it resyncs rather than piling up
 * latency. Non-binary frames (JSON control messages, keepalives) are ignored.
 */

const SAMPLE_RATE = 16000;
const LEAD_SECONDS = 0.2; // jitter buffer

export type ListenState = "connecting" | "listening" | "closed" | "error";

export class PcmListener {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private nextTime = 0;
  private levelRaf = 0;

  onState: (s: ListenState, detail?: string) => void = () => {};
  onLevel: (level0to1: number) => void = () => {};

  get muted() {
    return this.gain ? this.gain.gain.value === 0 : false;
  }

  setMuted(muted: boolean) {
    if (this.gain) this.gain.gain.value = muted ? 0 : 1;
  }

  async connect(url: string) {
    this.close();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx({ sampleRate: SAMPLE_RATE });
    // Autoplay policy: a user gesture is what calls connect(), so resume is allowed here.
    await this.ctx.resume().catch(() => {});
    this.gain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.gain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.nextTime = 0;
    this.pumpLevel();

    this.onState("connecting");
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    this.ws = ws;

    ws.onopen = () => this.onState("listening");
    ws.onerror = () => this.onState("error", "connection failed");
    ws.onclose = (e) => this.onState("closed", e.reason || undefined);
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") return; // control frame, not audio
      this.enqueue(ev.data as ArrayBuffer);
    };
  }

  private enqueue(buf: ArrayBuffer) {
    if (!this.ctx || !this.gain) return;
    const pcm = new Int16Array(buf);
    if (pcm.length === 0) return;

    const audio = this.ctx.createBuffer(1, pcm.length, SAMPLE_RATE);
    const ch = audio.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;

    const src = this.ctx.createBufferSource();
    src.buffer = audio;
    src.connect(this.gain);

    const now = this.ctx.currentTime;
    if (this.nextTime < now + 0.02) this.nextTime = now + LEAD_SECONDS; // fell behind — resync
    src.start(this.nextTime);
    this.nextTime += audio.duration;
  }

  private pumpLevel() {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.analyser) return;
      this.analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128));
      this.onLevel(Math.min(1, peak / 90));
      this.levelRaf = requestAnimationFrame(tick);
    };
    this.levelRaf = requestAnimationFrame(tick);
  }

  close() {
    if (this.levelRaf) cancelAnimationFrame(this.levelRaf);
    this.levelRaf = 0;
    try {
      this.ws?.close();
    } catch {
      /* already closed */
    }
    this.ws = null;
    this.analyser = null;
    this.gain = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
