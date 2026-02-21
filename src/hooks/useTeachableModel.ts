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

      // Extract weight files
      const weightFiles: { [key: string]: ArrayBuffer } = {};
      const weightManifest = modelJson.weightsManifest;
      if (weightManifest) {
        for (const group of weightManifest) {
          for (const path of group.paths) {
            const wFile = zip.file(path);
            if (wFile) {
              weightFiles[path] = await wFile.async("arraybuffer");
            }
          }
        }
      }

      // Create blob URLs for model loading
      // We need to create a modified model.json and serve weight files via blob URLs
      const weightBlobs: { [key: string]: string } = {};
      for (const [path, buffer] of Object.entries(weightFiles)) {
        const wBlob = new Blob([buffer], { type: "application/octet-stream" });
        weightBlobs[path] = URL.createObjectURL(wBlob);
      }

      // Update model.json paths to blob URLs
      if (modelJson.weightsManifest) {
        for (const group of modelJson.weightsManifest) {
          group.paths = group.paths.map((p: string) => weightBlobs[p] || p);
        }
      }

      const modelBlob = new Blob([JSON.stringify(modelJson)], { type: "application/json" });
      const modelUrl = URL.createObjectURL(modelBlob);

      // Dynamic import tf.js
      const tf = await import("@tensorflow/tfjs");
      modelInstance = await tf.loadLayersModel(modelUrl);

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
