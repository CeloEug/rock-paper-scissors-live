import { useEffect, useRef, forwardRef, useImperativeHandle, useState } from "react";

export interface WebcamHandle {
  getVideo: () => HTMLVideoElement | null;
}

const WebcamView = forwardRef<WebcamHandle>((_props, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    getVideo: () => videoRef.current,
  }));

  useEffect(() => {
    let stream: MediaStream | null = null;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 400, height: 400 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
        }
      } catch {
        setErrorMsg("Não foi possível acessar a câmera. Permita o acesso!");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden webcam-border">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-[320px] h-[320px] object-cover transform -scale-x-100"
      />
      {!hasPermission && !errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
          <p className="text-muted-foreground text-sm animate-pulse">
            Carregando câmera...
          </p>
        </div>
      )}
      {errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 p-4">
          <p className="text-foreground text-sm text-center">{errorMsg}</p>
        </div>
      )}
    </div>
  );
});

WebcamView.displayName = "WebcamView";

export default WebcamView;
