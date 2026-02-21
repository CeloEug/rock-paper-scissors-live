import { useState, useCallback } from "react";
import JSZip from "jszip";

export type Prediction = {
  className: string;
  probability: number;
};

export type GameChoice = "idle" | "rock" | "paper" | "scisors";

// We load the model manually using tf.js since @teachablemachine/image
// has compatibility issues. We'll use a simpler approach with tf.js directly.
let modelInstance: any = null;
let metadataLabels: string[] = [];

export function useTeachableModel() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadModel = useCallback(async () => {
    if (modelInstance) {
      setIsReady(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch and extract zip
      const response = await fetch("/model.zip");
      const blob = await response.blob();
      const zip = await JSZip.loadAsync(blob);

      // Extract metadata
      const metadataFile = zip.file("metadata.json");
      if (!metadataFile) throw new Error("metadata.json not found in model zip");
      const metadataText = await metadataFile.async("string");
      const metadata = JSON.parse(metadataText);
      metadataLabels = metadata.labels || [];

      // Extract model.json
      const modelFile = zip.file("model.json");
      if (!modelFile) throw new Error("model.json not found in model zip");
      const modelText = await modelFile.async("string");
      const modelJson = JSON.parse(modelText);

      // Extract weight files and concatenate into a single buffer
      const tf = await import("@tensorflow/tfjs");

      const weightManifest = modelJson.weightsManifest;
      const weightDataArrays: ArrayBuffer[] = [];
      const weightSpecs: any[] = [];

      if (weightManifest) {
        for (const group of weightManifest) {
          // Collect weight specs
          if (group.weights) {
            for (const w of group.weights) {
              weightSpecs.push({
                name: w.name,
                shape: w.shape,
                dtype: w.dtype || "float32",
              });
            }
          }
          // Collect weight data
          for (const path of group.paths) {
            const wFile = zip.file(path);
            if (wFile) {
              const buffer = await wFile.async("arraybuffer");
              weightDataArrays.push(buffer);
            }
          }
        }
      }

      // Concatenate all weight buffers
      const totalLength = weightDataArrays.reduce((sum, buf) => sum + buf.byteLength, 0);
      const weightData = new ArrayBuffer(totalLength);
      const view = new Uint8Array(weightData);
      let offset = 0;
      for (const buf of weightDataArrays) {
        view.set(new Uint8Array(buf), offset);
        offset += buf.byteLength;
      }

      // Load model from memory (no network requests needed)
      modelInstance = await tf.loadLayersModel(
        tf.io.fromMemory(modelJson.modelTopology, weightSpecs, weightData)
      );

      setIsReady(true);
    } catch (err) {
      console.error("Failed to load model:", err);
      setError(err instanceof Error ? err.message : "Failed to load model");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const predict = useCallback(
    async (videoElement: HTMLVideoElement): Promise<Prediction[]> => {
      if (!modelInstance) return [];

      try {
        const tf = await import("@tensorflow/tfjs");

        // Preprocess: resize to 224x224, normalize to 0-1
        const tensor = tf.tidy(() => {
          const img = tf.browser.fromPixels(videoElement);
          const resized = tf.image.resizeBilinear(img, [224, 224]);
          const normalized = resized.div(255.0);
          return normalized.expandDims(0);
        });

        const prediction = modelInstance.predict(tensor) as any;
        const probabilities = await prediction.data();
        tensor.dispose();
        prediction.dispose();

        return metadataLabels.map((label, i) => ({
          className: label,
          probability: probabilities[i] || 0,
        }));
      } catch (err) {
        console.error("Prediction error:", err);
        return [];
      }
    },
    []
  );

  const getTopPrediction = useCallback(
    async (videoElement: HTMLVideoElement): Promise<GameChoice> => {
      const predictions = await predict(videoElement);
      if (predictions.length === 0) return "idle";

      const top = predictions.reduce((a, b) =>
        a.probability > b.probability ? a : b
      );

      if (top.probability < 0.6) return "idle";
      return top.className as GameChoice;
    },
    [predict]
  );

  return { loadModel, isLoading, isReady, error, predict, getTopPrediction };
}
