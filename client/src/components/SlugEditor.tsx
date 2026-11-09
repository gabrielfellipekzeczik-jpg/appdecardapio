import { useEffect, useState } from "react";
import { Check, Link2, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

const clean = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

/** Endereço público do cardápio (appdecardapio.vercel.app/<endereço>). Criado a partir do nome; aqui o dono pode trocar. */
export function SlugEditor({ currentSlug }: { currentSlug: string }) {
  const [value, setValue] = useState(currentSlug);
  const [debounced, setDebounced] = useState(currentSlug);
  useEffect(() => setValue(currentSlug), [currentSlug]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.replace(/^-|-$/g, "")), 400);
    return () => window.clearTimeout(timer);
  }, [value]);

  const candidate = debounced;
  const changed = candidate !== currentSlug;
  const check = trpc.company.checkSlug.useQuery(
    { slug: candidate },
    { enabled: changed && candidate.length >= 3, staleTime: 5_000, retry: 1 }
  );
  const mutation = trpc.company.updateSlug.useMutation({
    onSuccess: ({ slug }) => {
      toast.success("Endereço atualizado.");
      // O painel também usa o endereço na URL: recarrega já no novo.
      window.location.href = `/${slug}/admin?config=1`;
    },
    onError: error => toast.error(error.message),
  });

  const origin = typeof window !== "undefined" ? window.location.host : "";
  const available = check.data?.available === true;
  const taken = check.data?.available === false;
  const tooShort = candidate.length > 0 && candidate.length < 3;
  const canSave =
    changed && available && !check.isFetching && value === debounced && !mutation.isPending;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="font-display text-xl">Endereço do cardápio</CardTitle>
        <p className="mt-1 text-sm text-[#776e63]">
          Criado a partir do nome do seu negócio. Troque só se quiser outro link.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex min-w-0 items-center overflow-hidden rounded-xl border border-[#e5e0d7] bg-[#fbfaf7] focus-within:ring-2 focus-within:ring-[#2f5d50]/20">
          <span className="flex shrink-0 items-center gap-1.5 border-r border-[#e5e0d7] px-3 text-sm text-[#776e63]">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">{origin}/</span>
          </span>
          <Input
            value={value}
            onChange={event => setValue(clean(event.target.value))}
            aria-label="Endereço do cardápio"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="h-11 min-w-0 flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <span className="flex w-9 shrink-0 items-center justify-center">
            {changed && check.isFetching && <Loader2 className="h-4 w-4 animate-spin text-[#a79b8d]" />}
            {changed && !check.isFetching && available && <Check className="h-4 w-4 text-emerald-600" />}
            {changed && !check.isFetching && taken && <X className="h-4 w-4 text-red-600" />}
          </span>
        </div>
        <p
          className={`text-xs ${taken || tooShort ? "text-red-600" : changed && available ? "text-emerald-600" : "text-[#9a9185]"}`}
        >
          {tooShort
            ? "Use pelo menos 3 letras ou números."
            : !changed
              ? `Seu cardápio: ${origin}/${currentSlug}`
              : check.isFetching
                ? "Verificando…"
                : taken
                  ? "Esse endereço já está em uso ou é reservado."
                  : available
                    ? "Disponível. Ao salvar, o link antigo deixa de funcionar."
                    : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => mutation.mutate({ slug: candidate })}
            disabled={!canSave}
            className="rounded-xl bg-[#2f5d50] text-white"
          >
            {mutation.isPending ? "Salvando…" : "Salvar endereço"}
          </Button>
          {changed && (
            <Button variant="ghost" onClick={() => setValue(currentSlug)} className="rounded-xl">
              Cancelar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
