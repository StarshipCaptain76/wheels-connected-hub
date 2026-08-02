import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, Loader2, Link2 } from "lucide-react";

const PRIVATE_BUCKETS = new Set(["gallery", "garage", "listings", "sponsors"]);

type Props = {
  /** Current value — storage path or full URL */
  value: string;
  /** Called with storage path (storePath=true) or public/signed URL */
  onChange: (value: string) => void;
  bucket: string;
  /** Folder prefix inside the bucket, e.g. "logos" or "covers" */
  folder?: string;
  /** If true, onChange receives storage path; otherwise a usable URL */
  storePath?: boolean;
  label?: string;
  maxMb?: number;
  className?: string;
};

/**
 * Image picker that uploads to Supabase Storage.
 * Still allows pasting a public URL as a fallback.
 *
 * For private buckets (gallery, garage, …) we store a stable
 * /object/public/… URL (re-signed on read by the server). Preview
 * uses a long-lived signed URL so the admin form shows the image.
 */
export function ImageUploadField({
  value,
  onChange,
  bucket,
  folder = "",
  storePath = false,
  label = "Image",
  maxMb = 5,
  className = "",
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  const displaySrc =
    preview ??
    (value && /^https?:\/\//i.test(value) ? value : null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setError(`Max ${maxMb}MB per image`);
      return;
    }

    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) throw new Error("Not signed in");

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = [folder, userId, `${crypto.randomUUID()}.${ext || "jpg"}`]
        .filter(Boolean)
        .join("/");

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      // Local preview while we resolve the stored value
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      if (storePath) {
        onChange(path);
      } else if (PRIVATE_BUCKETS.has(bucket)) {
        // Stable public-format URL for DB (server re-signs on every page load)
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        onChange(pub?.publicUrl ?? path);
        // Better on-screen preview: long-lived signed URL
        try {
          const { data: signed } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 7);
          if (signed?.signedUrl) setPreview(signed.signedUrl);
        } catch {
          /* keep objectUrl preview */
        }
      } else {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        if (pub?.publicUrl) {
          onChange(pub.publicUrl);
        } else {
          const { data: signed } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, 60 * 60 * 24 * 365);
          onChange(signed?.signedUrl ?? path);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function clear() {
    setPreview(null);
    onChange("");
    setError(null);
  }

  return (
    <div className={className}>
      <span className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-ink/70">
        {label}
        <button
          type="button"
          onClick={() => setShowUrl((s) => !s)}
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-ink/40 hover:text-ink"
        >
          <Link2 className="h-3 w-3" />
          {showUrl ? "Hide URL" : "Paste URL"}
        </button>
      </span>

      <div className="flex flex-wrap items-start gap-3">
        {displaySrc ? (
          <div className="relative h-24 w-24 overflow-hidden rounded-md border-2 border-ink bg-steel/20">
            <img src={displaySrc} alt="" className="h-full w-full object-contain" />
            <button
              type="button"
              onClick={clear}
              className="absolute -right-2 -top-2 rounded-full border-2 border-ink bg-primary p-0.5 text-paper"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : value && !/^https?:\/\//i.test(value) ? (
          <div className="flex h-24 w-24 items-center justify-center rounded-md border-2 border-ink bg-steel/20 p-2 text-center text-[10px] text-ink/50">
            Stored path
          </div>
        ) : null}

        <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-ink/40 text-ink/50 transition-colors hover:border-ink hover:text-ink">
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="text-[10px] font-bold uppercase">Upload</span>
            </>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {showUrl && (
        <input
          type="url"
          value={/^https?:\/\//i.test(value) ? value : ""}
          onChange={(e) => {
            setPreview(null);
            onChange(e.target.value);
          }}
          placeholder="https://…"
          className="mt-2 w-full rounded-md border-2 border-ink bg-paper px-3 py-2 text-sm"
        />
      )}

      {error && <p className="mt-1 text-xs text-primary">{error}</p>}
      <p className="mt-1 text-[10px] text-ink/40">JPG, PNG or WebP · max {maxMb}MB</p>
    </div>
  );
}
