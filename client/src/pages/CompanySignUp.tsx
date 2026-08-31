import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, CircleAlert, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(DIACRITICS_REGEX, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

export default function CompanySignUp() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!slugTouched) setSlug(slugify(name)); }, [name, slugTouched]);

  const slugCheck = trpc.company.checkSlug.useQuery({ slug }, { enabled: slug.length >= 3, staleTime: 5_000 });
  const signUpMutation = trpc.company.signUp.useMutation();

  // Already logged in with a Supabase session but hasn't finished creating a
  // company yet (e.g. came back after confirming their email).
  const alreadyLoggedInNoCompany = isAuthenticated && user && !user.companyId;

  const canSubmit = useMemo(() => name.length >= 2 && slug.length >= 3 && slugCheck.data?.available && (alreadyLoggedInNoCompany || (email.includes("@") && password.length >= 6)), [name, slug, slugCheck.data, alreadyLoggedInNoCompany, email, password]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      if (!alreadyLoggedInNoCompany) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setPendingConfirmation(true);
          setSubmitting(false);
          return;
        }
      }
      const result = await signUpMutation.mutateAsync({ name, slug });
      navigate(`/${result.slug}/admin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir o cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) return null;

  if (pendingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
        <Card className="max-w-md border-0 text-center shadow-xl"><CardContent className="p-8">
          <CheckCircle2 className="mx-auto h-10 w-10 text-[#347052]" />
          <h1 className="mt-4 font-display text-2xl font-bold">Confirme seu email</h1>
          <p className="mt-2 text-sm leading-6 text-[#776e63]">Enviamos um link de confirmação para {email}. Depois de confirmar, entre em <a href="/admin-login" className="font-semibold text-[#2f5d50] underline">/admin-login</a> com essa mesma conta pra terminar o cadastro do "{name}".</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6 py-12">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardContent className="p-8">
          <div className="brand-mark mx-auto flex h-11 w-11 items-center justify-center rounded-2xl"><Utensils className="h-5 w-5" /></div>
          <h1 className="mt-5 text-center font-display text-2xl font-bold">Cadastre seu restaurante</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="field-label">Nome do restaurante</label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Casa na Marmita" />
            </div>
            <div>
              <label className="field-label">Endereço do seu cardápio</label>
              <div className="flex items-center gap-1 text-sm text-[#776e63]">
                <span className="whitespace-nowrap">seudominio.com/</span>
                <Input required value={slug} onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }} className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7]" />
              </div>
              {slug.length >= 3 && slugCheck.data && (
                <p className={`mt-1 text-xs ${slugCheck.data.available ? "text-[#347052]" : "text-red-600"}`}>{slugCheck.data.available ? "Disponível" : "Esse endereço já está em uso ou não é válido"}</p>
              )}
            </div>
            {!alreadyLoggedInNoCompany && (
              <>
                <div>
                  <label className="field-label">Email</label>
                  <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
                </div>
                <div>
                  <label className="field-label">Senha</label>
                  <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" />
                </div>
              </>
            )}
            {error && <p className="flex items-center gap-2 text-sm text-red-600"><CircleAlert className="h-4 w-4" /> {error}</p>}
            <Button type="submit" disabled={!canSubmit || submitting} className="w-full rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]">
              {submitting ? "Criando..." : "Criar meu cardápio"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
