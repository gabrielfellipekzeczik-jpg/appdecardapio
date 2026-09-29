import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, CircleAlert, Utensils } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const RED      = "#ff1c2e";
const RED_DARK = "#d4000f";
const RED_BG   = "#fff0f1";

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

  const alreadyLoggedInNoCompany = isAuthenticated && user && !user.companyId;

  const canSubmit = useMemo(() =>
    name.length >= 2 && slug.length >= 3 && slugCheck.data?.available &&
    (alreadyLoggedInNoCompany || (email.includes("@") && password.length >= 6)),
    [name, slug, slugCheck.data, alreadyLoggedInNoCompany, email, password]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6"
        style={{ background: `radial-gradient(ellipse at top, ${RED_BG} 0%, #f7f6f2 60%)` }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="max-w-md border-0 text-center shadow-xl">
            <CardContent className="p-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, delay: 0.2 }}
              >
                <CheckCircle2 className="mx-auto h-12 w-12" style={{ color: RED }} />
              </motion.div>
              <h1 className="mt-4 font-display text-2xl font-bold">Confirme seu email</h1>
              <p className="mt-2 text-sm leading-6 text-[#776e63]">
                Enviamos um link de confirmação para <strong>{email}</strong>.
                Depois de confirmar, entre em{" "}
                <a href="/admin-login" className="font-semibold underline" style={{ color: RED }}>
                  /admin-login
                </a>{" "}
                com essa mesma conta pra terminar o cadastro do "{name}".
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: `radial-gradient(ellipse at top, ${RED_BG} 0%, #f7f6f2 60%)` }}
    >
      {/* Animated background blob */}
      <motion.div
        className="pointer-events-none fixed -top-40 -right-40 h-96 w-96 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${RED}18 0%, transparent 70%)` }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="border-0 shadow-2xl">
          <CardContent className="p-8">
            {/* Logo */}
            <motion.div
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: RED, boxShadow: `0 8px 24px ${RED}50` }}
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Utensils className="h-6 w-6 text-white" />
            </motion.div>

            <h1 className="mt-5 text-center font-display text-2xl font-bold">
              Cadastre seu restaurante
            </h1>
            <p className="mt-1 text-center text-sm text-[#776e63]">
              Comece a vender em minutos.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {[
                { label: "Nome do restaurante", key: "name" },
              ].map((_, __, arr) => null)}

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <label className="field-label">Nome do restaurante</label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Casa na Marmita"
                  className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7] focus-visible:ring-[#ff1c2e]/30"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                <label className="field-label">Endereço do seu cardápio</label>
                <div className="flex items-center gap-1 text-sm text-[#776e63]">
                  <span className="whitespace-nowrap">seudominio.com/</span>
                  <Input
                    required
                    value={slug}
                    onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                    className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7] focus-visible:ring-[#ff1c2e]/30"
                  />
                </div>
                {slug.length >= 3 && slugCheck.data && (
                  <motion.p
                    className={`mt-1 text-xs ${slugCheck.data.available ? "text-emerald-600" : "text-red-600"}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    {slugCheck.data.available ? "✓ Disponível" : "✗ Esse endereço já está em uso"}
                  </motion.p>
                )}
              </motion.div>

              {!alreadyLoggedInNoCompany && (
                <>
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    <label className="field-label">Email</label>
                    <Input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7] focus-visible:ring-[#ff1c2e]/30"
                    />
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <label className="field-label">Senha</label>
                    <Input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="mínimo 6 caracteres"
                      className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7] focus-visible:ring-[#ff1c2e]/30"
                    />
                  </motion.div>
                </>
              )}

              {error && (
                <motion.p
                  className="flex items-center gap-2 text-sm text-red-600"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <CircleAlert className="h-4 w-4" /> {error}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="w-full rounded-xl text-white disabled:opacity-50"
                  style={{ backgroundColor: RED, boxShadow: canSubmit ? `0 4px 18px ${RED}45` : "none" }}
                >
                  {submitting ? "Criando..." : "Criar meu cardápio"}
                </Button>
              </motion.div>

              <p className="text-center text-xs text-[#776e63]">
                Já tem conta?{" "}
                <a href="/admin-login" className="font-semibold underline" style={{ color: RED }}>
                  Entrar
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
