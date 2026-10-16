"use client";

import { useState } from "react";
import type { Localized } from "@darb/core";
import { uploadImage } from "@/components/join/PhotoField";
import styles from "./admin.module.css";

type Photo = { key: string; alt: Localized };
const MAX_PHOTOS = 12;

/**
 * A business's logo and photos, uploaded through the same /api/join/photos as the join form.
 * Two hidden inputs carry them to the save action: `logo` (a key or empty) and `photos` (JSON).
 */
export function MediaField({
  mediaUrl,
  uploads,
  logo: initialLogo,
  photos: initialPhotos,
  labels,
}: {
  mediaUrl: string;
  uploads: boolean;
  logo: string | null;
  photos: Photo[];
  labels: {
    logo: string;
    photos: string;
    add: string;
    uploading: string;
    off: string;
    failed: string;
    remove: string;
    moveFirst: string;
  };
}) {
  const [logo, setLogo] = useState(initialLogo);
  const [photos, setPhotos] = useState(initialPhotos);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const add = async (files: FileList | null, variant: "logo" | "photo") => {
    const list = [...(files ?? [])].slice(0, variant === "logo" ? 1 : MAX_PHOTOS - photos.length);
    if (!list.length) return;
    setBusy(true);
    setFailed(false);
    const added: Photo[] = [];
    for (const file of list) {
      const r = await uploadImage(file, variant);
      if (typeof r === "string") setFailed(true);
      else if (variant === "logo") setLogo(r.key);
      // The save action names new photos after the business.
      else added.push({ key: r.key, alt: {} });
    }
    if (added.length) setPhotos((p) => [...p, ...added]);
    setBusy(false);
  };

  const picker = (variant: "logo" | "photo", label: string) =>
    uploads ? (
      <label className={styles.ghost}>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={variant === "photo"}
          style={{ position: "absolute", inlineSize: 1, blockSize: 1, opacity: 0 }}
          onChange={(e) => {
            void add(e.target.files, variant);
            e.target.value = "";
          }}
        />
      </label>
    ) : null;

  return (
    <fieldset className={styles.row} style={{ border: 0, padding: 0, margin: 0 }}>
      <input type="hidden" name="logo" value={logo ?? ""} />
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      <div className={styles.field}>
        <span>{labels.logo}</span>
        {logo ? (
          <div className={styles.actions}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a media bucket preview */}
            <img
              src={`${mediaUrl}/${logo}`}
              alt={labels.logo}
              width={96}
              height={96}
              style={{ objectFit: "contain" }}
            />
            <button type="button" className={styles.ghost} onClick={() => setLogo(null)}>
              {labels.remove}
            </button>
          </div>
        ) : (
          picker("logo", labels.add)
        )}
      </div>
      <div className={styles.field}>
        <span>{labels.photos}</span>
        <div className={styles.actions}>
          {photos.map((p, i) => (
            <div key={p.key} className={styles.actions}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a media bucket preview */}
              <img
                src={`${mediaUrl}/${p.key}`}
                alt={`${labels.photos} ${i + 1}`}
                width={120}
                height={90}
                style={{ objectFit: "cover" }}
              />
              {i > 0 ? (
                <button
                  type="button"
                  className={styles.ghost}
                  onClick={() => setPhotos([p, ...photos.filter((x) => x !== p)])}
                >
                  {labels.moveFirst}
                </button>
              ) : null}
              <button
                type="button"
                className={styles.ghost}
                onClick={() => setPhotos(photos.filter((x) => x !== p))}
              >
                {labels.remove}
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS ? picker("photo", labels.add) : null}
        </div>
      </div>
      <p role="status" className={styles.hint}>
        {!uploads ? labels.off : busy ? labels.uploading : failed ? labels.failed : ""}
      </p>
    </fieldset>
  );
}
