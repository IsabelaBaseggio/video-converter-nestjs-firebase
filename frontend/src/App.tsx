// App.tsx
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import { VideoStatus } from "./types/video";

/** Backend URL */
const API_URL = "http://localhost:3000/api";

interface Video {
  id: string;
  title: string;
  status: VideoStatus;
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [status, setStatus] = useState<VideoStatus | "">("");
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);

  /** Anonymous Auth */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) setUser(currentUser);
      else await signInAnonymously(auth);
    });
    return () => unsub();
  }, []);

  /** Poll video status */
  useEffect(() => {
    if (!videoId || !user || status !== VideoStatus.PROCESSING) return;

    const intervalId = setInterval(async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`${API_URL}/videos/${videoId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: Video = (await res.json()) as Video;
        setStatus(data.status);

        if (
          data.status === VideoStatus.DONE ||
          data.status === VideoStatus.FAILED
        ) {
          setIsConverting(false);
          if (data.status === VideoStatus.DONE) fetchVideos();
          clearInterval(intervalId);
        }
      } catch {
        clearInterval(intervalId);
        setStatus(VideoStatus.FAILED);
        setIsConverting(false);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [videoId, user, status]);

  const handleUpload = async () => {
    if (!file || !user) return;
    setIsUploading(true);
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/videos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      setVideoId(data.id);
      setStatus(VideoStatus.UPLOADED);
      fetchVideos();
    } catch (err) {
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleConvert = async () => {
    if (!videoId || !user) return;
    const token = await user.getIdToken();
    await fetch(`${API_URL}/videos/${videoId}/convert`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setStatus(VideoStatus.PROCESSING);
    setIsConverting(true);
  };

  const fetchVideos = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch(`${API_URL}/videos`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: Video[] = await res.json();
    setVideos(data.filter((v) => v.status === VideoStatus.DONE));
  };

  useEffect(() => {
    if (user) fetchVideos();
  }, [user]);

  const styles = {
    container: { padding: 24, fontFamily: "sans-serif" },
    button: { marginLeft: 8 },
  };

  return (
    <div style={styles.container}>
      <h1>🎥 Video Converter</h1>
      {!user && <p>Autenticando...</p>}

      {user && (
        <>
          <p>
            <strong>User UID:</strong> {user.uid}
          </p>

          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <div style={{ marginTop: 16 }}>
            <button onClick={handleUpload} disabled={!file || isUploading}>
              {isUploading ? "Carregando..." : "Upload"}
            </button>

            <button
              onClick={handleConvert}
              disabled={!videoId || isConverting}
              style={styles.button}
            >
              {isConverting ? "Convertendo..." : "Converter"}
            </button>
          </div>

          <p style={{ marginTop: 16 }}>
            <strong>Status:</strong> {status || "—"}
          </p>

          {videos.length > 0 && (
            <>
              <h3 style={{ marginTop: 24 }}>Seus vídeos</h3>
              <ul>
                {videos.map((v) => (
                  <li key={v.id}>
                    {v.title || v.id} - {v.status}
                    <button
                      onClick={async () => {
                        const token = await user.getIdToken();
                        window.location.href = `${API_URL}/videos/${v.id}/download?token=${token}`;
                      }}
                      disabled={v.status !== "DONE"}
                      style={styles.button}
                    >
                      Baixar
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;
