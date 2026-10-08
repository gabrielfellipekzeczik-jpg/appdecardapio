import { useState } from "react";
import { useLocation } from "wouter";
import { LockKeyhole, Utensils } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

const RED    = "#ff1c2e";
const RED_BG = "#fff0f1";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        const msg = signInError.message.toLowerCase();
        setError(
          msg.includes("not confirmed")
            ? "Você ainda não confirmou o e-mail. Vá em \"Cadastrar restaurante\" e use o mesmo e-mail para receber um novo código."
            : "Email ou senha inválidos.",
        );
        return;
      }

      // "/admin" não é uma rota: o painel fica em /:slug/admin. Descobre para onde ir.
      const me = await utils.auth.me.fetch();
      if (me?.companyId) {
        const company = await utils.company.mine.fetch();
        navigate(company ? `/${company.slug}/admin` : "/cadastrar");
      } else if (me?.isSuperAdmin) {
        navigate("/super-admin");
      } else {
        // Conta criada e confirmada, mas sem restaurante: termina o cadastro.
        navigate("/cadastrar");
      }
    } catch (err) {
      console.error("[AdminLogin]", err);
      setError("Login feito, mas não foi possível carregar seu painel. Confira se o servidor está no ar e tente de novo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4"
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
        className="w-full max-w-sm"
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

            <h1 className="mt-5 text-center font-display text-2xl font-bold">Entrar</h1>
            <p className="mt-1 text-center text-sm leading-6 text-[#776e63]">
              Acesso ao painel do restaurante.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
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
                transition={{ delay: 0.15 }}
              >
                <label className="field-label">Senha</label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7] focus-visible:ring-[#ff1c2e]/30"
                />
              </motion.div>

              {error && (
                <motion.p
                  className="text-sm text-red-600"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {error}
                </motion.p>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl text-white"
                  style={{ backgroundColor: RED, boxShadow: `0 4px 18px ${RED}45` }}
                >
                  <LockKeyhole className="mr-2 h-4 w-4" />
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
              </motion.div>

              <p className="text-center text-xs text-[#776e63]">
                Não tem conta?{" "}
                <a href="/cadastrar" className="font-semibold underline" style={{ color: RED }}>
                  Cadastrar restaurante
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
