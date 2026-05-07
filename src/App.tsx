import {
  AlertTriangle,
  BookLock,
  CheckCircle2,
  Database,
  Download,
  FileCheck,
  GitFork,
  HeartHandshake,
  KeyRound,
  Lock,
  Mic,
  MicOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { decodeAudioTo16Khz, getLocalAi } from "./features/ai/aiClient";
import {
  createVault,
  rotateAgeKey,
  sealVault,
  unlockVault,
} from "./features/ledger/crypto";
import {
  summarizeWithDuckDb,
  type DuckDbSummary,
} from "./features/ledger/duckdb";
import {
  createCheckpoint,
  createEntryRecord,
  decryptEntries,
  downloadProofBundle,
  emptyDraft,
  exportProofBundle,
  latestCoveringCheckpoint,
  verifyChain,
} from "./features/ledger/ledger";
import {
  getVaultEnvelope,
  listCheckpoints,
  listEntries,
  putCheckpoint,
  putEntry,
  saveVaultEnvelope,
} from "./features/ledger/storage";
import type {
  ChainVerification,
  DecryptedEntry,
  EncryptedEntryRecord,
  EntryDraft,
  MerkleCheckpoint,
  VaultEnvelope,
  VaultSecret,
} from "./features/ledger/types";

type AppMode = "loading" | "needs-vault" | "locked" | "unlocked";
type AsyncState = "idle" | "busy" | "ready" | "error";

const repoUrl = __REPO_URL__;
const paypalUrl = __PAYPAL_URL__;

function App() {
  const [mode, setMode] = useState<AppMode>("loading");
  const [envelope, setEnvelope] = useState<VaultEnvelope | undefined>();
  const [secret, setSecret] = useState<VaultSecret | undefined>();
  const [records, setRecords] = useState<EncryptedEntryRecord[]>([]);
  const [entries, setEntries] = useState<DecryptedEntry[]>([]);
  const [checkpoints, setCheckpoints] = useState<MerkleCheckpoint[]>([]);
  const [verification, setVerification] = useState<ChainVerification>({
    status: "valid",
    checkedEntries: 0,
    errors: [],
  });
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft());
  const [tagText, setTagText] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [unlockPassphrase, setUnlockPassphrase] = useState("");
  const [rotationPassphrase, setRotationPassphrase] = useState("");
  const [notice, setNotice] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [duckState, setDuckState] = useState<AsyncState>("idle");
  const [duckSummary, setDuckSummary] = useState<DuckDbSummary | undefined>();
  const [aiState, setAiState] = useState<AsyncState>("idle");
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | undefined>(undefined);
  const mediaChunks = useRef<Blob[]>([]);

  const latestEntry = entries[0];
  const activeRecipient = secret?.ageKeys.find(
    (ageKey) => ageKey.id === secret.activeAgeKeyId,
  )?.recipient;

  const refreshLedger = useCallback(async (vaultSecret?: VaultSecret) => {
    const storedRecords = await listEntries();
    const storedCheckpoints = await listCheckpoints();
    setRecords(storedRecords);
    setCheckpoints(storedCheckpoints);
    if (vaultSecret) {
      const decrypted = await decryptEntries(vaultSecret, storedRecords);
      setEntries(decrypted.reverse());
      setVerification(await verifyChain(vaultSecret, storedRecords));
    }
  }, []);

  useEffect(() => {
    async function boot() {
      const storedEnvelope = await getVaultEnvelope();
      setEnvelope(storedEnvelope);
      setMode(storedEnvelope ? "locked" : "needs-vault");
      setRecords(await listEntries());
      setCheckpoints(await listCheckpoints());
    }
    boot().catch((bootError: unknown) => {
      setError(
        bootError instanceof Error
          ? bootError.message
          : "Could not open local ledger storage.",
      );
      setMode("needs-vault");
    });
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .catch(() => undefined);
    }
  }, []);

  const stats = useMemo(
    () => ({
      entries: records.length,
      checkpoints: checkpoints.length,
      rotations: secret?.ageKeys.length ?? 0,
    }),
    [checkpoints.length, records.length, secret?.ageKeys.length],
  );

  async function handleCreateVault() {
    setError(undefined);
    if (newPassphrase.length < 12) {
      setError("Use at least 12 characters for the vault passphrase.");
      return;
    }
    if (newPassphrase !== confirmPassphrase) {
      setError("Passphrases do not match.");
      return;
    }
    const created = await createVault(newPassphrase);
    await saveVaultEnvelope(created.envelope);
    setEnvelope(created.envelope);
    setSecret(created.secret);
    setNewPassphrase("");
    setConfirmPassphrase("");
    setMode("unlocked");
    setNotice("Vault created locally.");
    await refreshLedger(created.secret);
  }

  async function handleUnlock() {
    if (!envelope) return;
    setError(undefined);
    try {
      const unlocked = await unlockVault(envelope, unlockPassphrase);
      setSecret(unlocked);
      setUnlockPassphrase("");
      setMode("unlocked");
      setNotice("Vault unlocked.");
      await refreshLedger(unlocked);
    } catch {
      setError("Could not unlock the vault with that passphrase.");
    }
  }

  async function handleSealEntry() {
    if (!secret || draft.body.trim().length === 0) return;
    setError(undefined);
    const entry = await createEntryRecord(
      secret,
      { ...draft, tags: parseTags(tagText) },
      records.at(-1),
    );
    await putEntry(entry.record);
    setDraft(emptyDraft());
    setTagText("");
    setNotice(`Entry ${entry.record.sequence} sealed and signed.`);
    await refreshLedger(secret);
  }

  async function handleCheckpoint() {
    if (!secret || records.length === 0) return;
    const checkpoint = await createCheckpoint(
      secret,
      records,
      checkpoints.at(-1),
    );
    await putCheckpoint(checkpoint);
    setCheckpoints(await listCheckpoints());
    setNotice(`Checkpoint created: ${checkpoint.merkleRoot.slice(0, 16)}...`);
  }

  async function handleRotateKey() {
    if (!secret || !envelope) return;
    setError(undefined);
    if (!rotationPassphrase) {
      setError("Enter the vault passphrase before rotating the age key.");
      return;
    }
    try {
      await unlockVault(envelope, rotationPassphrase);
      const rotated = await rotateAgeKey(secret);
      const sealed = await sealVault(rotated, rotationPassphrase);
      await saveVaultEnvelope(sealed);
      setSecret(rotated);
      setEnvelope(sealed);
      setRotationPassphrase("");
      setNotice("Future entries will use the new age recipient.");
    } catch {
      setError("Passphrase check failed; key rotation was not applied.");
    }
  }

  async function handleExportProof(entry: DecryptedEntry) {
    if (!secret) return;
    let checkpoint = latestCoveringCheckpoint(entry, checkpoints);
    if (!checkpoint) {
      checkpoint = await createCheckpoint(secret, records, checkpoints.at(-1));
      await putCheckpoint(checkpoint);
      setCheckpoints(await listCheckpoints());
    }
    const bundle = await exportProofBundle(entry, records, checkpoint);
    downloadProofBundle(bundle);
    setNotice(`Proof bundle exported for entry ${entry.record.sequence}.`);
  }

  async function handleDuckDb() {
    setDuckState("busy");
    try {
      setDuckSummary(await summarizeWithDuckDb(entries));
      setDuckState("ready");
    } catch {
      setDuckSummary(undefined);
      setDuckState("error");
    }
  }

  async function handleReflect() {
    if (!draft.body.trim()) return;
    setAiState("busy");
    try {
      const reflection = await getLocalAi().reflect(draft.body);
      setDraft((current) => ({ ...current, reflection }));
      setAiState("ready");
    } catch {
      setAiState("error");
    }
  }

  async function handleToggleRecording() {
    if (recording) {
      mediaRecorder.current?.stop();
      return;
    }

    setAiState("busy");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaChunks.current = [];
    const recorder = new MediaRecorder(stream);
    mediaRecorder.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) mediaChunks.current.push(event.data);
    };
    recorder.onstop = () => {
      setRecording(false);
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(mediaChunks.current, { type: recorder.mimeType });
      decodeAudioTo16Khz(blob)
        .then((samples) => getLocalAi().transcribe(samples))
        .then((transcript) => {
          setDraft((current) => ({
            ...current,
            transcript,
            body: current.body.trim() ? current.body : transcript,
          }));
          setAiState("ready");
        })
        .catch(() => setAiState("error"));
    };
    recorder.start();
    setRecording(true);
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md bg-teal-700 text-white">
              <BookLock size={24} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Ledger Journal</h1>
              <p className="text-sm text-slate-600">
                age encrypted, Ed25519 signed, Merkle anchored
              </p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <a
              className="button-secondary"
              href={repoUrl}
              target="_blank"
              rel="noreferrer"
            >
              <GitFork size={16} aria-hidden="true" />
              Star on GitHub
            </a>
            <a
              className="button-secondary"
              href={paypalUrl}
              target="_blank"
              rel="noreferrer"
            >
              <HeartHandshake size={16} aria-hidden="true" />
              Support on PayPal
            </a>
            <span className="rounded-md border border-slate-200 px-3 py-2 font-mono text-xs text-slate-600">
              v{__APP_VERSION__} / {__COMMIT_SHA__}
            </span>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {notice ? (
          <Status
            tone="success"
            text={notice}
            onClose={() => setNotice(undefined)}
          />
        ) : null}
        {error ? (
          <Status
            tone="error"
            text={error}
            onClose={() => setError(undefined)}
          />
        ) : null}

        {mode === "loading" ? <Panel>Opening local ledger...</Panel> : null}
        {mode === "needs-vault" ? (
          <AuthPanel
            title="Create local vault"
            icon={<KeyRound size={22} aria-hidden="true" />}
            action="Create vault"
            onSubmit={handleCreateVault}
          >
            <label className="field">
              <span>New passphrase</span>
              <input
                aria-label="New passphrase"
                type="password"
                value={newPassphrase}
                onChange={(event) => setNewPassphrase(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Confirm passphrase</span>
              <input
                aria-label="Confirm passphrase"
                type="password"
                value={confirmPassphrase}
                onChange={(event) => setConfirmPassphrase(event.target.value)}
              />
            </label>
          </AuthPanel>
        ) : null}
        {mode === "locked" ? (
          <AuthPanel
            title="Unlock vault"
            icon={<Lock size={22} aria-hidden="true" />}
            action="Unlock"
            onSubmit={handleUnlock}
          >
            <label className="field">
              <span>Passphrase</span>
              <input
                aria-label="Passphrase"
                type="password"
                value={unlockPassphrase}
                onChange={(event) => setUnlockPassphrase(event.target.value)}
              />
            </label>
          </AuthPanel>
        ) : null}

        {mode === "unlocked" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
            <section className="space-y-5">
              <Panel>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="panel-title">New entry</h2>
                    <p className="text-sm text-slate-600">
                      Plaintext stays in memory until sealed into age
                      ciphertext.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={handleReflect}
                      disabled={aiState === "busy"}
                    >
                      <Sparkles size={16} aria-hidden="true" />
                      Reflect locally
                    </button>
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={handleToggleRecording}
                      disabled={aiState === "busy" && !recording}
                    >
                      {recording ? (
                        <MicOff size={16} aria-hidden="true" />
                      ) : (
                        <Mic size={16} aria-hidden="true" />
                      )}
                      {recording ? "Stop recording" : "Whisper note"}
                    </button>
                  </div>
                </div>
                <label className="field">
                  <span>Entry body</span>
                  <textarea
                    aria-label="Entry body"
                    value={draft.body}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    rows={8}
                  />
                </label>
                <div className="mt-4 grid gap-4 md:grid-cols-[1fr_180px]">
                  <label className="field">
                    <span>Tags</span>
                    <input
                      aria-label="Tags"
                      value={tagText}
                      onChange={(event) => setTagText(event.target.value)}
                      placeholder="work, family, idea"
                    />
                  </label>
                  <label className="field">
                    <span>Mood</span>
                    <select
                      aria-label="Mood"
                      value={draft.mood}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          mood: event.target.value,
                        }))
                      }
                    >
                      <option value="steady">steady</option>
                      <option value="clear">clear</option>
                      <option value="heavy">heavy</option>
                      <option value="grateful">grateful</option>
                      <option value="restless">restless</option>
                    </select>
                  </label>
                </div>
                {draft.transcript ? (
                  <MiniBlock title="Transcript" text={draft.transcript} />
                ) : null}
                {draft.reflection ? (
                  <MiniBlock title="Local reflection" text={draft.reflection} />
                ) : null}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">
                    {aiStatusText(aiState)}
                  </span>
                  <button
                    className="button-primary"
                    type="button"
                    onClick={handleSealEntry}
                    disabled={!draft.body.trim()}
                  >
                    <ShieldCheck size={17} aria-hidden="true" />
                    Seal entry
                  </button>
                </div>
              </Panel>

              <Panel>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="panel-title">Entries</h2>
                    <p className="text-sm text-slate-600">
                      Newest first, decrypted only for this unlocked session.
                    </p>
                  </div>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={handleCheckpoint}
                    disabled={records.length === 0}
                  >
                    <FileCheck size={16} aria-hidden="true" />
                    Create checkpoint
                  </button>
                </div>
                <div className="space-y-3">
                  {entries.length === 0 ? (
                    <p className="empty">No entries yet.</p>
                  ) : null}
                  {entries.map((entry) => (
                    <article className="entry-card" key={entry.record.id}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs text-slate-500">
                            #{entry.record.sequence}
                          </p>
                          <h3 className="text-base font-semibold">
                            {formatDate(entry.record.createdAt)}
                          </h3>
                        </div>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => handleExportProof(entry)}
                          title="Export proof bundle"
                        >
                          <Download size={17} aria-hidden="true" />
                        </button>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                        {entry.payload.body}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill>{entry.payload.mood}</Pill>
                        {entry.payload.tags.map((tag) => (
                          <Pill key={tag}>{tag}</Pill>
                        ))}
                      </div>
                      <p className="mt-3 break-all font-mono text-xs text-slate-500">
                        hash {entry.record.entryHash}
                      </p>
                    </article>
                  ))}
                </div>
              </Panel>
            </section>

            <aside className="space-y-5">
              <Panel>
                <h2 className="panel-title">Integrity</h2>
                <div
                  className={
                    verification.status === "valid"
                      ? "integrity-valid"
                      : "integrity-invalid"
                  }
                >
                  {verification.status === "valid" ? (
                    <CheckCircle2 size={20} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={20} aria-hidden="true" />
                  )}
                  <span>
                    {verification.status === "valid"
                      ? "Chain valid"
                      : "Chain invalid"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Stat label="Entries" value={stats.entries} />
                  <Stat label="Roots" value={stats.checkpoints} />
                  <Stat label="Keys" value={stats.rotations} />
                </div>
                {verification.errors.length > 0 ? (
                  <ul className="mt-4 space-y-2 text-sm text-red-700">
                    {verification.errors.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 space-y-2 text-xs text-slate-600">
                  <p className="break-all">
                    active recipient {activeRecipient}
                  </p>
                  <p className="break-all">
                    latest hash {latestEntry?.record.entryHash ?? "none"}
                  </p>
                </div>
              </Panel>

              <Panel>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="panel-title">DuckDB</h2>
                  <button
                    className="button-secondary"
                    type="button"
                    onClick={handleDuckDb}
                    disabled={duckState === "busy"}
                  >
                    <Database size={16} aria-hidden="true" />
                    Load DuckDB index
                  </button>
                </div>
                {duckState === "idle" ? (
                  <p className="empty">
                    Encrypted records stay in IndexedDB; decrypted rows are
                    indexed in memory.
                  </p>
                ) : null}
                {duckState === "busy" ? (
                  <p className="empty">Loading DuckDB-WASM...</p>
                ) : null}
                {duckState === "error" ? (
                  <p className="empty">
                    DuckDB unavailable in this browser session.
                  </p>
                ) : null}
                {duckState === "ready" && duckSummary ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-teal-800">
                      DuckDB ready, v{duckSummary.version}
                    </p>
                    <SummaryRows
                      title="Top tags"
                      rows={duckSummary.topTags.map((row) => [
                        row.tag,
                        row.count,
                      ])}
                    />
                    <SummaryRows
                      title="Moods"
                      rows={duckSummary.moods.map((row) => [
                        row.mood,
                        row.count,
                      ])}
                    />
                  </div>
                ) : null}
              </Panel>

              <Panel>
                <h2 className="panel-title">Future key</h2>
                <label className="field mt-3">
                  <span>Vault passphrase</span>
                  <input
                    aria-label="Vault passphrase for key rotation"
                    type="password"
                    value={rotationPassphrase}
                    onChange={(event) =>
                      setRotationPassphrase(event.target.value)
                    }
                  />
                </label>
                <button
                  className="button-secondary mt-4"
                  type="button"
                  onClick={handleRotateKey}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  Rotate age key
                </button>
              </Panel>
            </aside>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function AuthPanel({
  title,
  icon,
  action,
  onSubmit,
  children,
}: {
  title: string;
  icon: ReactNode;
  action: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Panel narrow>
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-blue-700 text-white">
          {icon}
        </div>
        <h2 className="panel-title">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
      <button
        className="button-primary mt-5 w-full justify-center"
        type="button"
        onClick={onSubmit}
      >
        {action}
      </button>
    </Panel>
  );
}

function Panel({
  children,
  narrow = false,
}: {
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <section className={narrow ? "panel mx-auto max-w-md" : "panel"}>
      {children}
    </section>
  );
}

function Status({
  tone,
  text,
  onClose,
}: {
  tone: "success" | "error";
  text: string;
  onClose: () => void;
}) {
  return (
    <div
      className={tone === "success" ? "status-success" : "status-error"}
      role="status"
    >
      <span>{text}</span>
      <button type="button" onClick={onClose}>
        Dismiss
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
      {children}
    </span>
  );
}

function MiniBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
      <p className="text-xs font-semibold uppercase text-blue-800">{title}</p>
      <p className="mt-1 text-sm leading-6 text-blue-950">{text}</p>
    </div>
  );
}

function SummaryRows({
  title,
  rows,
}: {
  title: string;
  rows: Array<[string, number]>;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
        {title}
      </p>
      <div className="space-y-1">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No rows.</p>
        ) : null}
        {rows.map(([label, count]) => (
          <div
            className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"
            key={label}
          >
            <span>{label}</span>
            <span className="font-mono">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function aiStatusText(state: AsyncState) {
  if (state === "busy") return "Local model loading or running.";
  if (state === "ready") return "Local AI result ready.";
  if (state === "error") return "Local AI unavailable in this browser session.";
  return "Local AI and Whisper load only after use.";
}

export default App;
