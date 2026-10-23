import { ImageSegmenter } from "@mediapipe/tasks-vision";
import wasmLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";

// Голова питомца перед шапкой обложки: маска «животное» от DeepLab v3 (MediaPipe Image Segmenter,
// 21 класс PASCAL VOC — собака, кошка, птица и др.). Модуль — отдельный ленивый чанк обложки:
// JS задачи, wasm (~11 МБ) и модель (public/models, ~2,7 МБ) грузятся только с нашего хоста и
// только когда посетитель открыл камеру. Фото никуда не уходит: всё считается в браузере.

/** Классы DeepLab v3, которые считаются питомцем. */
const PET_LABELS = new Set(["dog", "cat", "bird", "horse", "sheep", "cow"]);
/** Индексы тех же классов в порядке PASCAL VOC — если модель не отдала подписи. */
const PET_INDEXES = [3, 8, 10, 12, 13, 17];

export type PetMask = {
  /** Альфа-маска питомца (белый с прозрачностью) в размере кадра, поданного на вход. */
  canvas: HTMLCanvasElement;
  /** Доля кадра, занятая питомцем, 0…1. */
  coverage: number;
};

export type PetSegmenter = { segment(image: HTMLCanvasElement): PetMask };

let loading: Promise<PetSegmenter> | null = null;

/** Загружает сегментатор один раз; повторные вызовы получают тот же промис. */
export function loadPetSegmenter(): Promise<PetSegmenter> {
  loading ??= create().catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

async function create(): Promise<PetSegmenter> {
  const base = document.baseURI;
  const segmenter = await ImageSegmenter.createFromOptions(
    { wasmLoaderPath: new URL(wasmLoaderUrl, base).href, wasmBinaryPath: new URL(wasmBinaryUrl, base).href },
    {
      baseOptions: { modelAssetPath: new URL("models/deeplab_v3.tflite", base).href, delegate: "CPU" },
      runningMode: "IMAGE",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    },
  );
  const labels = segmenter.getLabels().map((label) => label.toLowerCase());
  const pets = labels.length ? labels.flatMap((label, i) => (PET_LABELS.has(label) ? [i] : [])) : PET_INDEXES;

  return {
    segment(image) {
      let mask: PetMask | null = null;
      segmenter.segment(image, (result) => {
        const masks = result.confidenceMasks ?? [];
        const first = masks[0];
        if (!first) return;
        const { width, height } = first;
        const planes = pets.map((i) => masks[i]?.getAsFloat32Array()).filter((p): p is Float32Array => !!p);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const out = ctx.createImageData(width, height);
        let sum = 0;
        for (let p = 0; p < width * height; p++) {
          let v = 0;
          for (const plane of planes) v = Math.max(v, plane[p]);
          sum += v;
          const o = p * 4;
          out.data[o] = 255;
          out.data[o + 1] = 255;
          out.data[o + 2] = 255;
          out.data[o + 3] = Math.round(Math.min(1, v) * 255);
        }
        ctx.putImageData(out, 0, 0);
        mask = { canvas, coverage: sum / (width * height) };
      });
      if (!mask) throw new Error("сегментатор не вернул маску");
      return mask;
    },
  };
}
