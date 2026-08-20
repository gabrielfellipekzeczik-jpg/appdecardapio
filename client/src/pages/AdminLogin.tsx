import { useState } from "react";
import { useLocation } from "wouter";
import { LockKeyhole, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Email ou senha inválidos.");
      return;
    }
    navigate("/admin");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
      <Card className="w-full max-w-sm border-0 shadow-xl">
        <CardContent className="p-8">
          <div className="brand-mark mx-auto flex h-11 w-11 items-center justify-center rounded-2xl">
            <Utensils className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-center font-display text-2xl font-bold">Entrar</h1>
          <p className="mt-1 text-center text-sm leading-6 text-[#776e63]">Acesso restrito à equipe da marmitaria.</p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="field-label">Email</label>
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7]" placeholder="voce@exemplo.com" />
            </div>
            <div>
              <label className="field-label">Senha</label>
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border-[#e5e0d7] bg-[#fbfaf7]" placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]">
              <LockKeyhole className="mr-2 h-4 w-4" /> {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
