import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Category } from "../../api";
import { useAuth } from "../../auth/AuthContext";
import SettingsLayout from "../../components/settings/SettingsLayout";
import CategoryForm from "../../components/settings/resources/categories/CategoryForm";

export default function CategoryFormPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isNew = !id;
  const [initial, setInitial] = useState<Category | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !id) return;
    api
      .adminCategory(id)
      .then(setInitial)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  if (!user?.roles?.includes("admin")) {
    return (
      <div className="page">
        <div className="admin-error">Not authorized.</div>
      </div>
    );
  }

  const backTo = isNew ? "/settings/categories" : `/settings/categories/${id}`;

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <SettingsLayout
      title={isNew ? "New Category" : "Edit Category"}
      description={isNew ? "Create a new category." : "Update this category."}
      backTo={backTo}
      backLabel="Back"
    >
      {error && <div className="auth-flash auth-flash-error">{error}</div>}
      <CategoryForm
        initial={isNew ? null : initial}
        onCancel={() => navigate(backTo)}
        onSuccess={(saved) => navigate(`/settings/categories/${saved.id}`)}
      />
    </SettingsLayout>
  );
}
