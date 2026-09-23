import { useRef, useState } from "react";
import { fetchUploadStatus, uploadFile } from "../lib/apiService";

type UploadKind = "fir" | "cdr" | "surveillance";

const kinds: { id: UploadKind; label: string; help: string }[] = [
  { id: "fir", label: "FIR / case report", help: "PDF, text, or JSON" },
  { id: "cdr", label: "Call detail records", help: "CSV or JSON" },
  { id: "surveillance", label: "CCTV / surveillance log", help: "CSV or JSON observation log" },
];

const acceptedByKind: Record<UploadKind, string> = {
  fir: ".pdf,.txt,.json,application/pdf,text/plain,application/json",
  cdr: ".csv,text/csv",
  surveillance: ".csv,.json,text/csv,application/json",
};

export default function CaseSourceUpload({ caseId }: { caseId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<UploadKind>("fir");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage(`Uploading ${file.name}…`);
    try {
      const { job_id } = await uploadFile(caseId, file, kind);
      setMessage("Upload received. Processing evidence…");
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        const job = await fetchUploadStatus(caseId, job_id);
        if (job.status === "complete") {
          setMessage(`${file.name} processed successfully.`);
          return;
        }
        if (job.status === "failed") {
          throw new Error(job.error || "Processing failed.");
        }
        setMessage(`Processing ${file.name} · ${job.progress}%`);
      }
      setMessage(`Upload accepted for ${file.name}; processing is still running.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed.");
      setMessage("");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="brief-section" aria-labelledby="case-evidence-upload-title">
      <div className="brief-heading">
        <h2 id="case-evidence-upload-title">Add evidence to this case</h2>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, maxWidth: 620 }}>
        Upload a case report, call detail records, or a structured surveillance observation log. Processing status will appear here; video clips are not ingested yet.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {kinds.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`btn ${kind === item.id ? "btn-primary" : ""}`}
            disabled={busy}
            onClick={() => {
              setKind(item.id);
              inputRef.current?.click();
            }}
            title={item.help}
          >
            {item.label}
          </button>
        ))}
        <input
          ref={inputRef}
          type="file"
          accept={acceptedByKind[kind]}
          hidden
          onChange={(event) => void handleFile(event.target.files?.[0])}
          aria-label="Choose case evidence file"
        />
      </div>
      {busy && <p role="status" style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10 }}>{message}</p>}
      {!busy && message && <p role="status" style={{ fontSize: 12, color: "var(--status-connected)", marginTop: 10 }}>{message}</p>}
      {error && <p role="alert" style={{ fontSize: 12, color: "var(--risk-high)", marginTop: 10 }}>{error}</p>}
    </section>
  );
}
