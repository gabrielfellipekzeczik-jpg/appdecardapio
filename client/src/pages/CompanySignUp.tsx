import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, CircleAlert, MailCheck, Utensils } from "lucide-react";
import { motion } from "framer-motion";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const RED      = "#ff1c2e";
const RED_BG   = "#fff0f1";

// Tamanho do código enviado por e-mail. Precisa bater com
// Supabase > Authentication > Providers > Email > "Email OTP Length" (padrão: 6).
const OTP_LENGTH = 6;
const RESEND_SECONDS = 60;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS = "rounded-xl border-[#e5e0d7] bg-[#fbfaf7] focus-visible:ring-[#ff1c2e]/30";

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(value: string) {
  return value.toLowerCase().normalize("NFD").replace(DIACRITICS_REGEX, "")
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
}

// Traduz os erros mais comuns (Supabase + falhas de rede/servidor) para algo que o usuário entende.
function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const msg = raw.toLowerCase();
  if (msg.includes("already registered") || msg.includes("already been registered"))
    return "Este e-mail já está cadastrado. Use \"Entrar\" para acessar sua conta.";
  if (msg.includes("rate limit") || msg.includes("too many") || msg.includes("security purposes"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo.";
  if (msg.includes("token has expired") || (msg.includes("invalid") && msg.includes("token")) || msg.includes("otp"))
    return "Código inválido ou expirado. Confira os números ou peça um novo código.";
  if (msg.includes("password") && (msg.includes("least") || msg.includes("weak") || msg.includes("short")))
    return "A senha não atende aos requisitos de segurança. Use uma senha maior.";
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("unexpected token")
    || msg.includes("unable to transform") || msg.includes("json"))
    return `[Erro de servidor] ${raw}`;
  return raw || "Não foi possível concluir o cadastro.";
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: `radial-gradient(ellipse at top, ${RED_BG} 0%, #f7f6f2 60%)` }}
    >
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
          <CardContent className="p-8">{children}</CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <motion.p
      role="alert"
      className="flex items-start gap-2 text-sm text-red-600"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> <span>{message}</span>
    </motion.p>
  );
}

export default function CompanySignUp() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => { if (!slugTouched) setSlug(slugify(name)); }, [name, slugTouched]);

  // Contagem regressiva para liberar o "Reenviar código".
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const slugCheck = trpc.company.checkSlug.useQuery(
    { slug },
    { enabled: slug.length >= 3, staleTime: 5_000, retry: 1 },
  );
  const signUpMutation = trpc.company.signUp.useMutation();

  const alreadyLoggedInNoCompany = Boolean(isAuthenticated && user && !user.companyId);

  const cleanEmail = email.trim().toLowerCase();
  const emailValid = EMAIL_REGEX.test(cleanEmail);
  const passwordValid = password.length >= 6;
  const passwordsMatch = password === confirmPassword;
  const slugTaken = slugCheck.data?.available === false;

  // O botão NÃO depende mais da resposta do servidor: antes, se a consulta do endereço
  // falhasse (servidor fora do ar, variável faltando), o botão ficava desabilitado para sempre.
  // A disponibilidade do endereço é conferida de novo, de forma obrigatória, ao enviar.
  const canSubmit = useMemo(
    () =>
      name.trim().length >= 2 &&
      slug.length >= 3 &&
      !slugTaken &&
      (alreadyLoggedInNoCompany ||
        (emailValid && passwordValid && confirmPassword.length > 0 && passwordsMatch)),
    [name, slug, slugTaken, alreadyLoggedInNoCompany, emailValid, passwordValid, confirmPassword, passwordsMatch],
  );

  // Cria a empresa depois que o e-mail foi confirmado e a sessão existe.
  const finishCompany = async () => {
    const result = await signUpMutation.mutateAsync({ name: name.trim(), slug });
    await utils.auth.me.invalidate();
    navigate(`/${result.slug}/admin`);
  };

  const startCooldown = () => setResendIn(RESEND_SECONDS);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      // 1) Confere o endereço no servidor ANTES de criar a conta (evita conta sem empresa).
      const slugResult = await utils.company.checkSlug.fetch({ slug });
      if (!slugResult.available) {
        setError("Esse endereço já está em uso ou não é válido. Escolha outro.");
        return;
      }

      // 2) Usuário já logado, só falta a empresa.
      if (alreadyLoggedInNoCompany) {
        await finishCompany();
        return;
      }

      // 3) Cria a conta; o Supabase envia o código por e-mail.
      const { data, error: signUpError } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (signUpError) throw signUpError;

      // E-mail já cadastrado e confirmado: o Supabase não dá erro, devolve um usuário sem "identities".
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setError("Este e-mail já está cadastrado. Use \"Entrar\" para acessar sua conta.");
        return;
      }

      // Se já veio sessão, a confirmação por e-mail está DESLIGADA no Supabase.
      if (data.session) {
        console.warn("[SignUp] Confirmação por e-mail desativada no Supabase; nenhum código foi enviado.");
        await finishCompany();
        return;
      }

      setCode("");
      setStep("verify");
      startCooldown();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (token: string = code) => {
    if (token.length !== OTP_LENGTH || submitting) return;
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: "signup",
      });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("Não foi possível iniciar a sessão após confirmar o e-mail.");
    } catch (err) {
      setError(friendlyError(err));
      setCode("");
      setSubmitting(false);
      return;
    }

    // E-mail confirmado. Se a criação da empresa falhar, volta ao formulário já logado
    // (só nome + endereço) para tentar de novo sem precisar de outro código.
    try {
      await finishCompany();
    } catch (err) {
      setStep("form");
      setError(friendlyError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || submitting) return;
    setError(null);
    setInfo(null);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: cleanEmail });
    if (resendError) {
      setError(friendlyError(resendError));
      return;
    }
    setCode("");
    setInfo("Enviamos um novo código. O anterior deixou de valer.");
    startCooldown();
  };

  if (authLoading && step === "form" && !submitting) return null;

  // ───────────────────────── Etapa 2: confirmar o código ─────────────────────────
  if (step === "verify") {
    return (
      <Shell>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, delay: 0.1 }}>
          <MailCheck className="mx-auto h-12 w-12" style={{ color: RED }} />
        </motion.div>
        <h1 className="mt-4 text-center font-display text-2xl font-bold">Confirme seu e-mail</h1>
        <p className="mt-2 text-center text-sm leading-6 text-[#776e63]">
          Enviamos um código de {OTP_LENGTH} dígitos para <strong>{cleanEmail}</strong>.
          Digite-o abaixo para criar o cardápio de "{name.trim()}".
        </p>

        <div className="mt-6 flex flex-col items-center gap-4">
          <InputOTP
            maxLength={OTP_LENGTH}
            value={code}
            onChange={(value) => { setCode(value); if (error) setError(null); }}
            onComplete={(value) => handleVerify(value)}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={submitting}
          >
            <InputOTPGroup>
              {Array.from({ length: OTP_LENGTH }, (_, index) => (
                <InputOTPSlot key={index} index={index} className="h-12 w-11 text-lg" />
              ))}
            </InputOTPGroup>
          </InputOTP>

          {error && <ErrorLine message={error} />}
          {info && (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> {info}
            </p>
          )}

          <Button
            type="button"
            onClick={() => handleVerify()}
            disabled={code.length !== OTP_LENGTH || submitting}
            className="w-full rounded-xl text-white disabled:opacity-50"
            style={{ backgroundColor: RED, boxShadow: code.length === OTP_LENGTH ? `0 4px 18px ${RED}45` : "none" }}
          >
            {submitting ? "Confirmando..." : "Confirmar e criar meu cardápio"}
          </Button>

          <div className="flex w-full items-center justify-between text-xs text-[#776e63]">
            <button
              type="button"
              onClick={() => { setStep("form"); setCode(""); setError(null); setInfo(null); }}
              className="font-semibold underline"
              style={{ color: RED }}
            >
              Corrigir e-mail
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendIn > 0 || submitting}
              className="font-semibold underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
              style={{ color: RED }}
            >
              {resendIn > 0 ? `Reenviar código em ${resendIn}s` : "Reenviar código"}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  // ───────────────────────── Etapa 1: formulário ─────────────────────────
  return (
    <Shell>
      <motion.div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ backgroundColor: RED, boxShadow: `0 8px 24px ${RED}50` }}
        whileHover={{ rotate: 10, scale: 1.1 }}
        transition={{ type: "spring", stiffness: 400 }}
      >
        <Utensils className="h-6 w-6 text-white" />
      </motion.div>

      <h1 className="mt-5 text-center font-display text-2xl font-bold">Cadastre seu restaurante</h1>
      <p className="mt-1 text-center text-sm text-[#776e63]">Comece a vender em minutos.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label className="field-label" htmlFor="signup-name">Nome do restaurante</label>
          <Input
            id="signup-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Casa na Marmita"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="signup-slug">Endereço do seu cardápio</label>
          <div className="flex items-center gap-1 text-sm text-[#776e63]">
            <span className="whitespace-nowrap">seudominio.com/</span>
            <Input
              id="signup-slug"
              required
              value={slug}
              onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
              className={INPUT_CLASS}
            />
          </div>
          {slug.length >= 3 && (
            <p
              className={`mt-1 text-xs ${
                slugTaken ? "text-red-600" : slugCheck.data?.available ? "text-emerald-600" : "text-[#9a9185]"
              }`}
            >
              {slugCheck.isFetching
                ? "Verificando..."
                : slugCheck.isError
                  ? "Não foi possível verificar agora; conferiremos ao criar."
                  : slugTaken
                    ? "✗ Esse endereço já está em uso ou não é válido"
                    : slugCheck.data?.available
                      ? "✓ Disponível"
                      : null}
            </p>
          )}
        </div>

        {!alreadyLoggedInNoCompany && (
          <>
            <div>
              <label className="field-label" htmlFor="signup-email">E-mail</label>
              <Input
                id="signup-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className={INPUT_CLASS}
              />
              {email.length > 0 && !emailValid && (
                <p className="mt-1 text-xs text-red-600">Digite um e-mail válido.</p>
              )}
            </div>

            <div>
              <label className="field-label" htmlFor="signup-password">Senha</label>
              <Input
                id="signup-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                className={INPUT_CLASS}
              />
              {password.length > 0 && !passwordValid && (
                <p className="mt-1 text-xs text-red-600">A senha precisa ter pelo menos 6 caracteres.</p>
              )}
            </div>

            <div>
              <label className="field-label" htmlFor="signup-confirm-password">Repita a senha</label>
              <Input
                id="signup-confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="digite a senha novamente"
                aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                className={INPUT_CLASS}
              />
              {confirmPassword.length > 0 && (
                <p className={`mt-1 text-xs ${passwordsMatch ? "text-emerald-600" : "text-red-600"}`}>
                  {passwordsMatch ? "✓ As senhas coincidem" : "✗ As senhas não coincidem"}
                </p>
              )}
            </div>
          </>
        )}

        {error && <ErrorLine message={error} />}

        <motion.div whileHover={{ scale: canSubmit ? 1.02 : 1 }} whileTap={{ scale: canSubmit ? 0.98 : 1 }}>
          <Button
            type="submit"
            disabled={!canSubmit || submitting}
            className="w-full rounded-xl text-white disabled:opacity-50"
            style={{ backgroundColor: RED, boxShadow: canSubmit ? `0 4px 18px ${RED}45` : "none" }}
          >
            {submitting ? "Aguarde..." : alreadyLoggedInNoCompany ? "Criar meu cardápio" : "Continuar"}
          </Button>
        </motion.div>

        <p className="text-center text-xs text-[#776e63]">
          Já tem conta?{" "}
          <a href="/admin-login" className="font-semibold underline" style={{ color: RED }}>
            Entrar
          </a>
        </p>
      </form>
    </Shell>
  );
}
