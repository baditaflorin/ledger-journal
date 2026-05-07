import { expose } from "comlink";
import { env, pipeline } from "@huggingface/transformers";

env.allowRemoteModels = true;
env.useBrowserCache = true;

let reflectorPromise: Promise<ReflectionPipeline> | undefined;
let whisperPromise: Promise<WhisperPipeline> | undefined;

export interface LocalAiApi {
  reflect(text: string): Promise<string>;
  transcribe(samples: Float32Array): Promise<string>;
}

type ReflectionPipeline = (
  text: string,
  options: { max_new_tokens: number },
) => Promise<unknown>;
type WhisperPipeline = (
  audio: Float32Array,
  options: { chunk_length_s: number; stride_length_s: number },
) => Promise<unknown>;

const api: LocalAiApi = {
  async reflect(text: string) {
    reflectorPromise ??= pipeline(
      "text2text-generation",
      "Xenova/flan-t5-small",
    ) as Promise<ReflectionPipeline>;
    const reflector = await reflectorPromise;
    const prompt = `Write a concise private journal reflection with one insight and one next question:\n\n${text}`;
    const output = await reflector(prompt, { max_new_tokens: 120 });
    return extractText(output, "generated_text");
  },

  async transcribe(samples: Float32Array) {
    whisperPromise ??= pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en",
    ) as Promise<WhisperPipeline>;
    const transcriber = await whisperPromise;
    const output = await transcriber(samples, {
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    return extractText(output, "text");
  },
};

function extractText(output: unknown, key: string): string {
  const value = Array.isArray(output) ? output[0] : output;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (key in record) return String(record[key]).trim();
  }
  return String(output).trim();
}

expose(api);
