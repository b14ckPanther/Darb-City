"use client";

import { useId, useState } from "react";
import type { JoinCopy } from "@/content/join";
import type { Uploaded } from "@/lib/join-form";
import styles from "./Join.module.css";

const MAX_BYTES = 8 * 1024 * 1024;
type UploadError = "photoType" | "photoBig" | "photoFailed";

/** One image to /api/join/photos; the API reads, shrinks and stores it, and answers its key. */
export async function uploadImage(
  file: File,
  variant: "photo" | "logo",
): Promise<Uploaded | UploadError> {
  if (!file.type.startsWith("image/")) return "photoType";
  if (file.size > MAX_BYTES) return "photoBig";
  const body = new FormData();
  body.set("file", file);
  try {
    const res = await fetch(`/api/join/photos${variant === "logo" ? "?variant=logo" : ""}`, {
      method: "POST",
      body,
    });
    if (res.status === 201) return (await res.json()) as Uploaded;
    if (res.status === 413) return "photoBig";
    if (res.status === 400) return "photoType";
  } catch {
    // Shown below as "didn't upload".
  }
  return "photoFailed";
}

/** The logo and up to `max` photos: previews, remove, and "show first" to reorder. */
export function PhotoField({
  copy,
  errors,
  logo,
  photos,
  max,
  onLogo,
  onPhotos,
}: {
  copy: JoinCopy["check"];
  errors: JoinCopy["errors"];
  logo: Uploaded | null;
  photos: Uploaded[];
  max: number;
  onLogo: (u: Uploaded | null) => void;
  onPhotos: (u: Uploaded[]) => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(0);
  const [problem, setProblem] = useState<UploadError | null>(null);

  const add = async (files: FileList | null, variant: "photo" | "logo") => {
    const list = [...(files ?? [])].slice(0, variant === "logo" ? 1 : max - photos.length);
    if (!list.length) return;
    setProblem(null);
    setBusy((b) => b + list.length);
    const done: Uploaded[] = [];
    for (const file of list) {
      const r = await uploadImage(file, variant);
      setBusy((b) => b - 1);
      if (typeof r === "string") setProblem(r);
      else if (variant === "logo") onLogo(r);
      else done.push(r);
    }
    if (done.length) onPhotos([...photos, ...done].slice(0, max));
  };

  return (
    <div className={styles.photos}>
      <p id={`${id}-hint`} className={styles.hint}>
        {copy.photosHint}
      </p>
      <div className={styles.thumbs}>
        <div className={styles.thumb} data-logo="">
          {logo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- an upload preview */}
              <img src={logo.url} alt={copy.logo} />
              <button type="button" className={styles.thumbButton} onClick={() => onLogo(null)}>
                {copy.remove}
                <span className={styles.srOnly}>{` ${copy.logo}`}</span>
              </button>
            </>
          ) : (
            <label className={styles.add}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.srOnly}
                aria-describedby={`${id}-hint`}
                onChange={(e) => {
                  void add(e.target.files, "logo");
                  e.target.value = "";
                }}
              />
              {copy.addLogo}
            </label>
          )}
        </div>
        {photos.map((p, i) => (
          <div key={p.key} className={styles.thumb}>
            {/* eslint-disable-next-line @next/next/no-img-element -- an upload preview */}
            <img src={p.url} alt={`${copy.photos} ${i + 1}`} />
            <div className={styles.thumbTools}>
              {i > 0 ? (
                <button
                  type="button"
                  className={styles.thumbButton}
                  onClick={() => onPhotos([p, ...photos.filter((x) => x !== p)])}
                >
                  {copy.moveFirst}
                  <span className={styles.srOnly}>{` (${i + 1})`}</span>
                </button>
              ) : null}
              <button
                type="button"
                className={styles.thumbButton}
                onClick={() => onPhotos(photos.filter((x) => x !== p))}
              >
                {copy.remove}
                <span className={styles.srOnly}>{` (${i + 1})`}</span>
              </button>
            </div>
          </div>
        ))}
        {photos.length < max ? (
          <label className={`${styles.thumb} ${styles.add}`}>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className={styles.srOnly}
              aria-describedby={`${id}-hint`}
              onChange={(e) => {
                void add(e.target.files, "photo");
                e.target.value = "";
              }}
            />
            {copy.addPhotos}
          </label>
        ) : null}
      </div>
      <p role="status" className={problem ? styles.fieldError : styles.hint}>
        {busy > 0 ? copy.uploading : problem ? errors[problem] : ""}
      </p>
    </div>
  );
}
