export const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // raw file, before downscaling
export const ALLOWED_PHOTO_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

export class EvidenceUploadError extends Error {}

/**
 * Uploads a base64 data-URL photo to the real /api/evidence/upload
 * endpoint (backed by Supabase Storage), reporting real byte-level upload
 * progress via XHR. Resolves with the durable URL the backend actually
 * stored the file at — never a made-up or optimistic value. Rejects with
 * the exact server-provided error message on failure.
 */
export function uploadEvidenceImage(
  dataUrl: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/evidence/upload");
    xhr.setRequestHeader("Content-Type", "application/json");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        body &&
        typeof body === "object" &&
        "url" in body
      ) {
        onProgress?.(100);
        resolve(String((body as { url: unknown }).url));
        return;
      }
      const message =
        body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : `Upload failed (${xhr.status || "network error"})`;
      reject(new EvidenceUploadError(message));
    };

    xhr.onerror = () => {
      reject(
        new EvidenceUploadError("Network error during upload. Check your connection and retry."),
      );
    };

    xhr.send(JSON.stringify({ dataUrl }));
  });
}

/** Best-effort cleanup of an evidence photo the user removed or replaced
 * before submitting. Never throws — a failed cleanup shouldn't block the
 * user, it just leaves an unreferenced file in storage. */
export function deleteEvidenceImage(url: string): void {
  fetch("/api/evidence/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  }).catch(() => {
    // Best-effort only.
  });
}

/**
 * Confirms the uploaded URL actually resolves to a real, fetchable image
 * before letting the user continue — catches the case where the upload
 * "succeeded" but the file is somehow not actually retrievable.
 */
export async function verifyEvidenceUrl(url: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    throw new EvidenceUploadError("Uploaded, but couldn't verify the photo is reachable. Retry.");
  }
  if (!res.ok) {
    throw new EvidenceUploadError(
      `Uploaded, but the photo isn't accessible yet (status ${res.status}). Retry.`,
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new EvidenceUploadError(
      "Uploaded, but the stored file doesn't look like an image. Retry.",
    );
  }
}

export function validatePhotoFile(file: File): string | null {
  if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
    return "Please choose a JPEG, PNG, WEBP or GIF image.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return "That image is too large (max 8 MB).";
  }
  return null;
}
