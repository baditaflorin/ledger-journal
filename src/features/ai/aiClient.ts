import { wrap, type Remote } from "comlink";
import type { LocalAiApi } from "./aiWorker";

let api: Remote<LocalAiApi> | undefined;

export function getLocalAi(): Remote<LocalAiApi> {
  if (!api) {
    const worker = new Worker(new URL("./aiWorker.ts", import.meta.url), {
      type: "module",
    });
    api = wrap<LocalAiApi>(worker);
  }
  return api;
}

export async function decodeAudioTo16Khz(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext();
  const buffer = await context.decodeAudioData(await blob.arrayBuffer());
  const source = buffer.getChannelData(0);
  const targetRate = 16_000;
  const ratio = buffer.sampleRate / targetRate;
  const length = Math.floor(source.length / ratio);
  const resampled = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    resampled[index] = source[Math.floor(index * ratio)] ?? 0;
  }
  await context.close();
  return resampled;
}
