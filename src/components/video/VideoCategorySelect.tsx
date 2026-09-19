import { useEffect, useState, useMemo } from "react";
import { api, type VideoCategory } from "../../api";

interface VideoCategorySelectProps {
  value: number | null;
  onChange: (id: number | null) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function VideoCategorySelect({
  value,
  onChange,
  loading: externalLoading,
  disabled = false,
  className,
}: VideoCategorySelectProps) {
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadingState = externalLoading ?? loading;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .videoCategories()
      .then((cats) => {
        if (!cancelled) setCategories(cats);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(
    () =>
      [...categories].sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    [categories]
  );

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      disabled={disabled || loadingState}
      className={`video-category-select ${className ?? ""}`.trim()}
    >
      <option value="">Uncategorized</option>
      {loadingState ? (
        <option value="" disabled>
          Loading…
        </option>
      ) : (
        sorted.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))
      )}
    </select>
  );
}
