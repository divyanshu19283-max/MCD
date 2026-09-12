import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { jsonResponse, readJsonBody, withApiErrors } from "@/lib/api-response.server";
import { ApiError, deleteEvidencePhoto, uploadEvidencePhoto } from "@/lib/complaints-api.server";

const uploadSchema = z.object({
  dataUrl: z.string().min(1).max(11_500_000),
});

const deleteSchema = z.object({
  url: z.string().min(1),
});

/**
 * Real, standalone evidence upload endpoint. The report form calls this the
 * moment a photo is picked — independent of submitting the complaint — so
 * the image is durably in Storage (and its URL confirmed) before the user
 * is ever allowed to continue. POST returns the real, publicly-servable
 * URL; DELETE removes a photo the user changed their mind about.
 */
export const Route = createFileRoute("/api/evidence/upload")({
  server: {
    handlers: {
      POST: async ({ request }) =>
        withApiErrors(async () => {
          const body = await readJsonBody(request);
          const parsed = uploadSchema.safeParse(body);
          if (!parsed.success) {
            throw new ApiError(400, "Invalid upload payload", parsed.error.flatten());
          }
          const url = await uploadEvidencePhoto(parsed.data.dataUrl);
          return jsonResponse({ url }, 201);
        }),
      DELETE: async ({ request }) =>
        withApiErrors(async () => {
          const body = await readJsonBody(request);
          const parsed = deleteSchema.safeParse(body);
          if (!parsed.success) {
            throw new ApiError(400, "Invalid delete payload", parsed.error.flatten());
          }
          await deleteEvidencePhoto(parsed.data.url);
          return jsonResponse({ ok: true });
        }),
    },
  },
});
