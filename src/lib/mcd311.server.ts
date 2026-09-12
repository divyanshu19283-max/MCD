import { ApiError } from "./complaints-api.server";

const MCD_WEB_BASE_URL = "https://api-admin.everythingcivic.com/api/v1";
export const MCD_COMPLAINT_CHANNEL_ID = "247";

type MCDSubmitInput = {
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  address?: string;
  landmark?: string;
  categoryId?: string;
  subCategoryId?: string;
  zoneId?: string;
  wardId?: string;
  image?: Blob | null;
  imageName?: string;
  firstName?: string;
  lastName?: string;
  mobile?: string;
  email?: string;
};

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) throw new ApiError(500, `${name} is not configured on the server.`);
  return value;
}

/**
 * Sends directly to the same web complaint-creation endpoint observed in the
 * official MCD web portal. No MCD mobile Bearer token/login is used here.
 */
function extractMcdReference(value: unknown): string | null {
  const keys = [
    "complaint_number", "complaint_no", "complaintNumber", "complaintNo",
    "issue_number", "issue_no", "issueNumber", "issueNo", "reference", "ticket_number",
    "ticketNumber", "grievance_number", "grievanceNo", "grievance_number", "id",
  ];
  const seen = new Set<object>();
  function visit(node: unknown, depth = 0): string | null {
    if (depth > 6 || node == null) return null;
    if (typeof node === "string") return null;
    if (typeof node !== "object") return null;
    const obj = node as Record<string, unknown>;
    if (seen.has(obj)) return null;
    seen.add(obj);
    for (const key of keys) {
      const v = obj[key];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number" && Number.isFinite(v)) return String(v);
    }
    for (const v of Object.values(obj)) {
      const found = visit(v, depth + 1);
      if (found) return found;
    }
    if (Array.isArray(node)) {
      for (const v of node) {
        const found = visit(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  return visit(value);
}

export async function submitComplaintToMcd(input: MCDSubmitInput) {
  const apiKey = env("MCD_WEB_API_KEY") ?? env("MCD_API_KEY") ?? requiredEnv("MCD_WEB_API_KEY");
  const firstName = input.firstName?.trim();
  const lastName = input.lastName?.trim() || "";
  const mobile = input.mobile?.trim();
  const email = input.email?.trim();
  if (!firstName || !mobile || !email) {
    throw new ApiError(400, "Citizen first name, mobile number and email are required for MCD submission.");
  }

  const categoryId = input.categoryId;
  const subCategoryId = input.subCategoryId;
  if (!categoryId || !subCategoryId) {
    throw new ApiError(400, "An MCD category and subcategory must be selected before submission.");
  }
  const zoneId = input.zoneId ?? env("MCD_ZONE_ID") ?? "";
  const wardId = input.wardId ?? env("MCD_WARD_ID") ?? "";

  const form = new FormData();
  form.append("channel_id", MCD_COMPLAINT_CHANNEL_ID);
  form.append("first_name", firstName);
  form.append("last_name", lastName);
  form.append("mobile_number", mobile);
  form.append("email", email);
  form.append("issues[0][category_id]", categoryId);
  form.append("issues[0][sub_category_id]", subCategoryId);
  form.append("issues[0][title]", input.title);
  form.append("issues[0][description]", input.description);
  form.append("issues[0][zone_id]", zoneId);
  form.append("issues[0][ward_id]", wardId);
  form.append("issues[0][address_radio]", env("MCD_ADDRESS_RADIO") ?? "0");
  form.append("issues[0][landmark]", input.landmark ?? env("MCD_LANDMARK") ?? "");
  form.append("issues[0][address]", input.address ?? "");
  form.append("issues[0][latitude]", String(input.latitude));
  form.append("issues[0][longitude]", String(input.longitude));
  form.append("issues[0][image_is_uploaded]", input.image ? "1" : "0");
  form.append("otp", env("MCD_OTP") ?? "");

  if (input.image) {
    form.append("issues[0][image]", input.image, input.imageName ?? "evidence.jpg");
  }

  const response = await fetch(
    `${MCD_WEB_BASE_URL}/issue/citywisecreateissue?apikey=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        appid: "16",
        fromapp: "3",
        Origin: "https://mcd.everythingcivic.com",
        Referer: "https://mcd.everythingcivic.com/",
        timezone: "Asia/Calcutta",
      },
      body: form,
    },
  );

  const raw = await response.text();
  let payload: any = raw;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    // keep text
  }

  if (!response.ok) {
    throw new ApiError(502, `MCD complaint submission failed (${response.status}).`, payload);
  }

  return { payload, reference: extractMcdReference(payload) };
}
