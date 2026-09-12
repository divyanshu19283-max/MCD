import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  Crosshair,
  ImageUp,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Shell from "@/components/Shell";
import MapView from "@/components/MapView";
import LocationSearch from "@/components/LocationSearch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ISSUE_TYPES, createComplaint, type IssueType } from "@/lib/complaints";
import { MCD_CATEGORIES, getMcdCategory } from "@/lib/mcd-data";
import { ISSUE_ICON } from "@/lib/issue-icons";
import { getCitizenId } from "@/lib/citizen-identity";
import {
  deleteEvidenceImage,
  uploadEvidenceImage,
  validatePhotoFile,
  verifyEvidenceUrl,
} from "@/lib/evidence-upload";

export const Route = createFileRoute("/report")({
  validateSearch: z.object({
    type: z.enum(ISSUE_TYPES).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Report a Power Issue — LocalFix" },
      {
        name: "description",
        content:
          "Report broken streetlights, outages, damaged poles and sparking wires with a photo and map location, then track the fix.",
      },
      { property: "og:title", content: "Report a Power Issue — LocalFix" },
      {
        property: "og:description",
        content: "Snap it, pin it, send it. Track your electrical complaint to resolution.",
      },
    ],
  }),
  component: ReportPage,
});

const STEPS = [
  { n: 1, label: "Issue" },
  { n: 2, label: "Evidence" },
  { n: 3, label: "Location" },
  { n: 4, label: "Details" },
] as const;

type StepNum = (typeof STEPS)[number]["n"];
type Dir = "fwd" | "back";
type UploadStatus = "empty" | "reading" | "uploading" | "verifying" | "success" | "error";

function ReportPage() {
  const navigate = useNavigate();
  const { type: presetType } = Route.useSearch();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastDataUrlRef = useRef<string | null>(null);

  const [step, setStep] = useState<StepNum>(1);
  const [dir, setDir] = useState<Dir>("fwd");
  const [type, setType] = useState<IssueType | null>(presetType ?? null);
  const [mcdCategoryId, setMcdCategoryId] = useState<number | null>(() => getMcdCategory(presetType ?? null)?.id ?? null);
  const [mcdSubcategoryId, setMcdSubcategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  // `photoPreview` is the local (possibly downscaled) data URL shown while
  // uploading. `photoUrl` is only set once the backend has actually stored
  // the file AND that URL has been verified reachable — that's the only
  // thing that counts as "uploaded" for gating Continue/Submit.
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("empty");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function next(n: StepNum) {
    setDir("fwd");
    setStep(n);
  }
  function back(n: StepNum) {
    setDir("back");
    setStep(n);
  }
  function jump(n: StepNum) {
    if (n > step) return;
    setDir("back");
    setStep(n);
  }

  // Reverse-geocode the pinned coordinates into a readable address.
  useEffect(() => {
    if (!coords) {
      setAddress(null);
      return;
    }
    const controller = new AbortController();
    setAddressLoading(true);
    const t = setTimeout(() => {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.lat}&lon=${coords.lng}`,
        { signal: controller.signal },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { display_name?: string } | null) => {
          setAddress(data?.display_name ?? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setAddress(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
          }
        })
        .finally(() => setAddressLoading(false));
    }, 300);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // Depend on the coords object itself (not just its fields) so a stale
    // closure can never fire the lookup against out-of-date coordinates.
  }, [coords]);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const validationError = validatePhotoFile(file);
    if (validationError) {
      setUploadStatus("error");
      setUploadError(validationError);
      toast.error(validationError);
      return;
    }
    setUploadStatus("reading");
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = () => {
      // Downscale before uploading so the evidence photo stores reliably
      // and uploads fast, then send the result to the real backend.
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        const dataUrl = ctx
          ? (ctx.drawImage(img, 0, 0, canvas.width, canvas.height),
            canvas.toDataURL("image/jpeg", 0.75))
          : String(reader.result);
        setPhotoPreview(dataUrl);
        void startUpload(dataUrl);
      };
      img.onerror = () => {
        setUploadStatus("error");
        setUploadError("Couldn't read that photo. Try another one.");
      };
      img.src = String(reader.result);
    };
    reader.onerror = () => {
      setUploadStatus("error");
      setUploadError("Couldn't read that photo. Try another one.");
    };
    reader.readAsDataURL(file);
  }

  /** Uploads to the real backend, then verifies the returned URL is
   * actually reachable, before ever marking the upload as successful. */
  async function startUpload(dataUrl: string) {
    lastDataUrlRef.current = dataUrl;
    setPhotoUrl(null);
    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadError(null);
    try {
      const url = await uploadEvidenceImage(dataUrl, setUploadProgress);
      setUploadStatus("verifying");
      await verifyEvidenceUrl(url);
      setPhotoUrl(url);
      setUploadStatus("success");
    } catch (err) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Upload failed. Please retry.");
    }
  }

  function retryUpload() {
    if (lastDataUrlRef.current) void startUpload(lastDataUrlRef.current);
  }

  function removePhoto() {
    if (photoUrl) deleteEvidenceImage(photoUrl);
    lastDataUrlRef.current = null;
    setPhotoPreview(null);
    setPhotoUrl(null);
    setUploadStatus("empty");
    setUploadProgress(0);
    setUploadError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude) ||
          Math.abs(latitude) > 90 ||
          Math.abs(longitude) > 180
        ) {
          setLocating(false);
          toast.error("Got an invalid location fix. Try 'Change location' instead.");
          return;
        }
        setCoords({ lat: latitude, lng: longitude });
        setLocating(false);
        setPickerOpen(false);
        toast.success("Location captured");
      },
      (err) => {
        setLocating(false);
        // Distinguish *why* geolocation failed instead of one generic
        // message, so the user knows whether to grant permission, retry,
        // or fall back to picking a point on the map.
        const message =
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow location access, or use 'Change location' to pin it on the map."
            : err.code === err.POSITION_UNAVAILABLE
              ? "Your location is unavailable right now. Try 'Change location' instead."
              : err.code === err.TIMEOUT
                ? "Getting your location took too long. Try again or use 'Change location'."
                : "Couldn't get your location. Try 'Change location' instead.";
        toast.error(message);
        // If browser geolocation is blocked (common on plain HTTP LAN URLs),
        // immediately open the manual picker so the report is not blocked.
        setPickerOpen(true);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submit() {
    if (!type || !mcdCategoryId || !mcdSubcategoryId) {
      back(1);
      toast.error("Select an MCD category and subcategory first.");
      return;
    }
    if (uploadStatus !== "success" || !photoUrl) {
      back(2);
      toast.error("A verified photo upload is required before submitting.");
      return;
    }
    if (!coords) {
      back(3);
      toast.error("Set the location before submitting.");
      return;
    }
    if (description.trim().length < 5) {
      toast.error("Add a short description first.");
      return;
    }
    setSubmitting(true);
    try {
      if (!firstName.trim() || !mobile.trim() || !email.trim()) {
        toast.error("Add your name, mobile number and email first.");
        setSubmitting(false);
        return;
      }
      const c = await createComplaint({
        type,
        description: description.trim(),
        photo: photoUrl,
        ...coords,
        ...(address ? { area: address } : {}),
        firstName: firstName.trim(),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        mobile: mobile.trim(),
        email: email.trim(),
        mcdCategoryId,
        mcdSubcategoryId,
        citizenId: getCitizenId(),
      });
      toast.success(`Complaint ${c.id} submitted — classified as ${c.severity} severity`);
      navigate({ to: "/complaint/$id", params: { id: c.id } });
    } catch (err) {
      setSubmitting(false);
      // Surfacing the real cause (instead of one generic message for every
      // failure) is what made a bad/out-of-range location impossible to
      // diagnose before — the request failed silently with no clue why.
      const detail = err instanceof Error ? err.message : String(err);
      console.error("Complaint submission failed:", detail);
      toast.error(`Couldn't save your complaint: ${detail || "please try again."}`);
    }
  }

  const Icon = type ? ISSUE_ICON[type] : null;

  return (
    <Shell
      title="Report an issue"
      subtitle="Four quick steps — you'll get a complaint ID instantly."
    >
      <div className="mx-auto max-w-xl">
        <StepProgress current={step} onJump={jump} />

        <div className="panel relative mt-5 overflow-hidden p-4 sm:p-6">
          <div
            key={step}
            className={cn(
              "animate-in fade-in duration-300 ease-out",
              dir === "fwd" ? "slide-in-from-right-4" : "slide-in-from-left-4",
            )}
          >
            {step === 1 && (
              <div>
                <FieldHeading label="MCD complaint type" hint="Select the real MCD category and subcategory." />

                <label htmlFor="mcdCategory" className="mt-4 block text-xs font-semibold">Category</label>
                <select
                  id="mcdCategory"
                  value={mcdCategoryId ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const category = MCD_CATEGORIES.find((c) => c.id === id) ?? null;
                    setMcdCategoryId(category?.id ?? null);
                    setMcdSubcategoryId(null);
                    setType((category?.name as IssueType | undefined) ?? null);
                  }}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-3 text-sm"
                >
                  <option value="">Select category</option>
                  {MCD_CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}{category.nameHi ? ` (${category.nameHi})` : ""}
                    </option>
                  ))}
                </select>

                <label htmlFor="mcdSubcategory" className="mt-4 block text-xs font-semibold">Subcategory</label>
                <select
                  id="mcdSubcategory"
                  value={mcdSubcategoryId ?? ""}
                  disabled={!mcdCategoryId}
                  onChange={(e) => setMcdSubcategoryId(Number(e.target.value) || null)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-3 text-sm disabled:opacity-50"
                >
                  <option value="">Select subcategory</option>
                  {(MCD_CATEGORIES.find((c) => c.id === mcdCategoryId)?.subcategories ?? []).map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>

                {mcdCategoryId && mcdSubcategoryId && (
                  <p className="mt-3 rounded-lg bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
                    MCD category ID: <span className="font-semibold text-foreground">{mcdCategoryId}</span> · subcategory ID: <span className="font-semibold text-foreground">{mcdSubcategoryId}</span>
                  </p>
                )}

                <StepNav>
                  <Button
                    onClick={() => next(2)}
                    disabled={!mcdCategoryId || !mcdSubcategoryId}
                    className="w-full transition-transform active:scale-[0.98]"
                    size="lg"
                  >
                    Continue
                  </Button>
                </StepNav>
              </div>
            )}

            {step === 2 && (
              <div>
                <FieldHeading
                  label="Add evidence"
                  hint="Required — upload a photo of the issue to continue."
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />

                {photoPreview ? (
                  <div className="relative mt-3 animate-in fade-in zoom-in-95 overflow-hidden rounded-2xl ring-1 ring-border duration-200">
                    <img
                      src={photoPreview}
                      alt="Preview of the reported issue"
                      className={cn(
                        "h-56 w-full object-cover transition-[filter] duration-200",
                        uploadStatus !== "success" && "brightness-75",
                      )}
                    />

                    {(uploadStatus === "uploading" || uploadStatus === "verifying") && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 text-white">
                        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                        <span className="text-xs font-semibold">
                          {uploadStatus === "uploading"
                            ? `Uploading… ${uploadProgress}%`
                            : "Verifying upload…"}
                        </span>
                        {uploadStatus === "uploading" && (
                          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/25">
                            <div
                              className="h-full rounded-full bg-white transition-all duration-150"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {uploadStatus === "error" && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 p-4 text-center text-white">
                        <AlertTriangle className="size-6 text-destructive" aria-hidden="true" />
                        <span className="max-w-xs text-xs font-semibold">{uploadError}</span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={retryUpload}
                          className="mt-1"
                        >
                          <RotateCcw className="size-3.5" aria-hidden="true" /> Retry upload
                        </Button>
                      </div>
                    )}

                    {uploadStatus === "success" && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-success/90 px-2.5 py-1 text-[11px] font-bold text-success-foreground shadow-sm">
                        <Check className="size-3.5" aria-hidden="true" /> Uploaded
                      </span>
                    )}

                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="rounded-lg bg-background/85 px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        Replace photo
                      </button>
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="grid size-8 place-items-center rounded-full bg-background/85 shadow-sm backdrop-blur-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label="Remove photo"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFiles(e.dataTransfer.files);
                    }}
                    className={cn(
                      "mt-3 flex h-52 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      dragOver
                        ? "scale-[1.01] border-primary bg-primary/8 text-foreground"
                        : uploadStatus === "error"
                          ? "border-destructive/50 bg-destructive/5 text-muted-foreground"
                          : "border-border bg-secondary/20 text-muted-foreground hover:border-primary/50 hover:bg-secondary/30 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-12 place-items-center rounded-full transition-colors duration-200",
                        dragOver
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/70 text-muted-foreground",
                      )}
                    >
                      <Camera className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-semibold text-foreground">
                      {dragOver ? "Drop it here" : "Drag & drop a photo"}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/80">
                      <ImageUp className="size-3.5" aria-hidden="true" /> or click to upload · JPG,
                      PNG, WEBP, GIF · max 8 MB
                    </span>
                    {uploadStatus === "error" && uploadError && (
                      <span className="mt-1 flex max-w-xs items-start gap-1.5 text-center text-xs font-medium text-destructive">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {uploadError}
                      </span>
                    )}
                  </button>
                )}

                <p className="mt-2 text-xs text-muted-foreground">
                  A photo is required. Continue unlocks once it's uploaded and verified.
                </p>

                <StepNav>
                  <Button variant="secondary" onClick={() => back(1)} size="lg">
                    <ArrowLeft className="size-4" aria-hidden="true" /> Back
                  </Button>
                  <Button
                    onClick={() => next(3)}
                    disabled={uploadStatus !== "success"}
                    size="lg"
                    className="flex-1"
                  >
                    {uploadStatus === "uploading" || uploadStatus === "verifying" ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Uploading…
                      </>
                    ) : (
                      "Continue"
                    )}
                  </Button>
                </StepNav>
              </div>
            )}

            {step === 3 && (
              <div>
                <FieldHeading label="Location" hint="Where is the issue?" />

                <LocationSearch
                  className="mt-3"
                  placeholder="Search for an address to pin instead…"
                  onSelect={({ lat, lng, label }) => {
                    setCoords({ lat, lng });
                    setAddress(label);
                    setPickerOpen(false);
                    toast.success("Location set from search");
                  }}
                />

                <div className="relative mt-3 overflow-hidden rounded-2xl ring-1 ring-border transition-all duration-300">
                  <MapView
                    picked={coords}
                    {...(pickerOpen ? { onPick: setCoords } : {})}
                    className={cn(
                      "w-full !rounded-none !border-0 !shadow-none transition-[height] duration-300",
                      pickerOpen ? "h-64 sm:h-72" : "h-40",
                    )}
                    zoom={coords ? 15 : 12}
                  />
                  {pickerOpen && (
                    <span className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
                      <span className="animate-in fade-in rounded-full border border-border bg-card/95 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm">
                        Tap the map to drop a pin
                      </span>
                    </span>
                  )}
                  {!coords && !pickerOpen && (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-card/50 backdrop-blur-[1px]">
                      <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                        No location selected yet
                      </span>
                    </div>
                  )}
                </div>

                <p
                  className="mt-3 flex items-start gap-2 rounded-lg bg-secondary/30 px-3 py-2.5 text-sm text-muted-foreground"
                  aria-live="polite"
                >
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 break-words">
                    {addressLoading
                      ? "Looking up address…"
                      : coords
                        ? address
                        : "No location selected yet"}
                  </span>
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={useMyLocation} disabled={locating}>
                    {locating ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Crosshair className="size-4" aria-hidden="true" />
                    )}
                    {locating ? "Locating…" : "Use my location"}
                  </Button>
                  <Button
                    variant={pickerOpen ? "default" : "outline"}
                    onClick={() => setPickerOpen((v) => !v)}
                  >
                    {pickerOpen ? (
                      <>
                        <Check className="size-4" aria-hidden="true" /> Done
                      </>
                    ) : (
                      "Change location"
                    )}
                  </Button>
                </div>

                <StepNav>
                  <Button variant="secondary" onClick={() => back(2)} size="lg">
                    <ArrowLeft className="size-4" aria-hidden="true" /> Back
                  </Button>
                  <Button onClick={() => next(4)} disabled={!coords} size="lg" className="flex-1">
                    Continue
                  </Button>
                </StepNav>
              </div>
            )}

            {step === 4 && (
              <div>
                <FieldHeading
                  label="Details"
                  hint="Add a short description, then review and submit."
                />
                <label htmlFor="description" className="sr-only">
                  Describe the issue
                </label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell us what you see — landmark, how long it's been like this, any danger."
                  className="mt-3 min-h-24"
                />

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="text-xs font-semibold">First name</label>
                    <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Your first name" />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="text-xs font-semibold">Last name</label>
                    <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Your last name" />
                  </div>
                  <div>
                    <label htmlFor="mobile" className="text-xs font-semibold">Mobile number</label>
                    <input id="mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="10-digit mobile number" />
                  </div>
                  <div>
                    <label htmlFor="email" className="text-xs font-semibold">Email</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="you@example.com" />
                  </div>
                </div>

                <div className="mt-4 space-y-2 rounded-xl bg-secondary/25 p-3">
                  {type && Icon && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      {getMcdCategory(type)?.name ?? type}
                    </p>
                  )}
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      {coords ? (address ?? "Pinned location") : "No location selected"}
                    </span>
                  </p>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <ImageUp className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    {photoUrl ? "Photo uploaded and verified" : "No photo uploaded"}
                  </p>
                </div>

                <StepNav>
                  <Button variant="secondary" onClick={() => back(3)} size="lg">
                    <ArrowLeft className="size-4" aria-hidden="true" /> Back
                  </Button>
                  <Button
                    onClick={submit}
                    disabled={
                      submitting || uploadStatus !== "success" || description.trim().length < 5
                    }
                    className="flex-1 transition-transform active:scale-[0.98]"
                    size="lg"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Submitting…
                      </>
                    ) : (
                      <>
                        <Send className="size-4" aria-hidden="true" /> Submit complaint
                      </>
                    )}
                  </Button>
                </StepNav>
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function FieldHeading({ label, hint }: { label: string; hint?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold">{label}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StepNav({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 flex items-center gap-2">{children}</div>;
}

function StepProgress({ current, onJump }: { current: StepNum; onJump: (n: StepNum) => void }) {
  return (
    <div className="flex items-center" aria-label="Report progress">
      {STEPS.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <div key={s.n} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
            <button
              type="button"
              onClick={() => onJump(s.n)}
              disabled={s.n > current}
              className="flex flex-col items-center gap-1.5 focus-visible:outline-none disabled:cursor-not-allowed"
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-all duration-300",
                  done && "bg-primary text-primary-foreground",
                  active &&
                    "pulse-soft bg-primary text-primary-foreground shadow-[0_0_0_4px_oklch(0.84_0.18_96/0.25)]",
                  !done && !active && "bg-secondary text-muted-foreground",
                )}
              >
                {done ? <Check className="check-pop size-4" aria-hidden="true" /> : s.n}
              </span>
              <span
                className={cn(
                  "hidden text-[11px] font-semibold transition-colors duration-300 sm:block",
                  active || done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span className="mx-2 h-[2px] flex-1 overflow-hidden rounded-full bg-border sm:mx-3">
                <span
                  className={cn(
                    "block h-full origin-left rounded-full bg-primary transition-transform duration-500 ease-out",
                    current > s.n ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
