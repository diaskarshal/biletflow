import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import { errorMessage } from "../lib/format";
import { buttonClass } from "./Button";
import { ErrorState } from "./EmptyState";

export function CoverUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { data, error } = await api.POST("/api/v1/uploads/cover", {
        body: { image: "" },
        bodySerializer: () => {
          const form = new FormData();
          form.append("image", file);
          return form;
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => onChange(data.url),
  });

  return (
    <div className="space-y-2">
      <label className={`${buttonClass("secondary")} inline-block cursor-pointer focus-within:ring-2 focus-within:ring-brand`}>
        {upload.isPending ? "Uploading..." : value ? "Change image" : "Choose image"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          disabled={upload.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload.mutate(file);
          }}
        />
      </label>
      <p className="text-sm">JPEG, PNG or WebP, up to 5 MB.</p>
      {upload.isError && <ErrorState message={errorMessage(upload.error, "Could not upload the image")} />}
      {value && (
        <div className="flex items-center gap-3">
          <img src={value} alt="Cover preview" className="h-24 w-20 border border-slate-300 object-cover" />
          <button type="button" className="underline" onClick={() => onChange("")}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
