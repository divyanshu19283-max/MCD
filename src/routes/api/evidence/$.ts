import { createFileRoute } from "@tanstack/react-router";

const EVIDENCE_BUCKET = "complaint-evidence";
const PATH_PATTERN = /^evidence\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|gif)$/i;

/**
 * Serves evidence photos from the private storage bucket. The bucket itself
 * isn't publicly listable — this route only ever returns objects whose path
 * matches the exact shape the report upload writes (evidence/<uuid>.<ext>),
 * so it can't be used to fetch arbitrary files.
 */
export const Route = createFileRoute("/api/evidence/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        if (!PATH_PATTERN.test(path)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from(EVIDENCE_BUCKET).download(path);
        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }
        const ext = path.split(".").pop()!.toLowerCase();
        const contentType =
          ext === "png"
            ? "image/png"
            : ext === "webp"
              ? "image/webp"
              : ext === "gif"
                ? "image/gif"
                : "image/jpeg";
        return new Response(data, {
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
