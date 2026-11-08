import { useEffect, useState } from "react";
import { Bot, Loader2, MessageCircle, Power, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  idle: { label: "Desconectado", className: "bg-[#efede8] text-[#776e63]" },
  starting: { label: "Conectando…", className: "bg-[#fff0d7] text-[#a05c32]" },
  qr: { label: "Leia o QR code", className: "bg-[#fff0d7] text-[#a05c32]" },
  connected: { label: "Conectado", className: "bg-[#e2f1e7] text-[#347052]" },
  error: { label: "Atenção", className: "bg-[#fbe4df] text-[#b4452f]" },
};

/** Conecta o WhatsApp da loja (QR code) e configura o atendimento automático com IA. */
export function WhatsappBotCard() {
  const utils = trpc.useUtils();
  const query = trpc.whatsapp.status.useQuery(undefined, {
    // Enquanto conecta/espera o QR, consulta com mais frequência.
    refetchInterval: (q) => (["starting", "qr"].includes(q.state.data?.status ?? "") ? 2_500 : 15_000),
  });
  const refresh = () => utils.whatsapp.status.invalidate();
  const connect = trpc.whatsapp.connect.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const disconnect = trpc.whatsapp.disconnect.useMutation({ onSuccess: () => { toast.success("WhatsApp desconectado."); refresh(); }, onError: (e) => toast.error(e.message) });
  const saveSettings = trpc.whatsapp.updateSettings.useMutation({ onSuccess: () => { toast.success("Configurações salvas."); refresh(); }, onError: (e) => toast.error(e.message) });

  const data = query.data;
  const [instructions, setInstructions] = useState("");
  const [loadedInstructions, setLoadedInstructions] = useState<string | null>(null);
  useEffect(() => {
    if (data && loadedInstructions === null) { setInstructions(data.instructions); setLoadedInstructions(data.instructions); }
  }, [data, loadedInstructions]);

  const status = data?.status ?? "idle";
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.idle;
  const wantsConnection = data?.desired === "connected";
  const busy = connect.isPending || disconnect.isPending;

  return (
    <Card className="border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
      <CardHeader className="pb-4">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#e2f1e7] text-[#347052]"><MessageCircle className="h-5 w-5" /></div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="font-display text-xl">Atendimento automático no WhatsApp</CardTitle>
              <Badge className={`border-0 ${badge.className}`}>{badge.label}{status === "connected" && data?.phone ? ` · +${data.phone}` : ""}</Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[#776e63]">Clique em Conectar e leia o QR code com o WhatsApp do negócio. A IA responde dúvidas básicas e manda o link do seu cardápio.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {query.isError && <p className="rounded-xl bg-[#fbe4df] p-3 text-sm text-[#b4452f]">Não foi possível carregar o status do WhatsApp. Tente de novo em instantes.</p>}

        {data && !data.serviceOnline && (
          <div className="flex gap-3 rounded-xl bg-[#fff0d7] p-3 text-sm text-[#7a4a1f]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>O atendimento automático está fora do ar no momento. Você já pode clicar em Conectar: o QR code aparece assim que ele voltar.</p>
          </div>
        )}

        {data?.error && <p className="rounded-xl bg-[#fbe4df] p-3 text-sm text-[#b4452f]">{data.error}</p>}

        {status === "qr" && data?.qr && (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#eeeae3] p-5 sm:flex-row">
            <img src={data.qr} alt="QR code para conectar o WhatsApp" className="h-56 w-56 rounded-xl bg-white p-2" />
            <ol className="list-decimal space-y-1.5 pl-5 text-sm text-[#5d554b]">
              <li>No celular, abra o <b>WhatsApp</b>.</li>
              <li>Toque em <b>Configurações → Aparelhos conectados → Conectar um aparelho</b>.</li>
              <li>Aponte a câmera para este QR code.</li>
              <li className="list-none text-xs text-[#a79b8d]">O código muda a cada poucos segundos; esta tela atualiza sozinha.</li>
            </ol>
          </div>
        )}
        {(status === "starting" || (status === "qr" && !data?.qr)) && wantsConnection && (
          <p className="flex items-center gap-2 text-sm text-[#776e63]"><Loader2 className="h-4 w-4 animate-spin" /> Preparando a conexão…</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!wantsConnection || status === "idle" || status === "error" ? (
            <Button disabled={busy} onClick={() => connect.mutate()} className="rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]">
              {connect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}Conectar WhatsApp
            </Button>
          ) : (
            <Button variant="outline" disabled={busy} onClick={() => disconnect.mutate()} className="rounded-xl border-[#e5e0d7]">
              {disconnect.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}{status === "connected" ? "Desconectar" : "Cancelar"}
            </Button>
          )}
        </div>

        <div className="rounded-xl border border-[#eeeae3] p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Bot className="mt-0.5 h-4 w-4 text-[#a05c32]" />
              <div>
                <p className="text-sm font-semibold">Responder automaticamente com IA</p>
                <p className="text-xs text-[#776e63]">Desligado, o WhatsApp fica conectado mas o assistente não responde nada.</p>
              </div>
            </div>
            <Switch checked={data?.aiEnabled ?? true} disabled={!data || saveSettings.isPending} onCheckedChange={(aiEnabled) => saveSettings.mutate({ aiEnabled })} aria-label="Responder automaticamente com IA" />
          </div>
          <label htmlFor="bot-instructions" className="field-label mt-4 block">Informações extras para o assistente (opcional)</label>
          <Textarea id="bot-instructions" rows={4} maxLength={1500} value={instructions} onChange={(e) => setInstructions(e.target.value)}
            placeholder="Ex.: Temos opção vegetariana todo dia. Marmitas congeladas só sob encomenda." />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-[#a79b8d]">{instructions.length}/1500 · Horário, pagamento e entrega já vêm das suas Regras de pedido.</p>
            <Button size="sm" disabled={saveSettings.isPending || instructions === (loadedInstructions ?? "")} onClick={() => saveSettings.mutate({ instructions }, { onSuccess: () => setLoadedInstructions(instructions) })} className="rounded-xl bg-[#a05c32] text-white hover:bg-[#8a4e2b]">Salvar</Button>
          </div>
        </div>

        <div className="rounded-xl bg-[#f7f6f2] p-4 text-xs leading-5 text-[#776e63]">
          <p className="font-semibold text-[#29251f]">Como o assistente se comporta</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Só responde a mensagens de clientes que te chamaram; nunca inicia conversa, não faz divulgação nem manda para grupos.</li>
            <li>Responde preço, cardápio, como pedir, endereço, horário, pagamento e entrega, sempre com o link do cardápio. Qualquer outro assunto fica para você.</li>
            <li>Só cita preços e o link do seu cardápio; respostas com qualquer outro valor ou link são descartadas.</li>
            <li>Se você responder pelo celular, ele se cala naquela conversa por 6 horas. Se o cliente escrever “SAIR”, não recebe mais nada.</li>
            <li>Digita como uma pessoa (pausa antes de responder) e tem limites de mensagens por contato e por hora.</li>
          </ul>
          <p className="mt-2 text-[#a05c32]">Importante: esta conexão não é a API oficial do WhatsApp e reduz, mas não elimina, o risco de bloqueio do número. Prefira um número dedicado ao negócio.</p>
        </div>
      </CardContent>
    </Card>
  );
}
