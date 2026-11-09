import { useState } from "react";
import { Eye, RotateCw, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Largura e altura do "celular" da prévia, em pixels de tela de verdade. */
const PHONE_W = 390;
const PHONE_H = 800;

function PhoneFrame({ src, scale, title }: { src: string; scale: number; title: string }) {
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-[2.4rem] border-[10px] border-[#1f1b16] bg-[#1f1b16] shadow-2xl"
      style={{ width: PHONE_W * scale + 20, height: PHONE_H * scale + 20 }}
    >
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-[#1f1b16]"
      />
      <iframe
        title={title}
        src={src}
        className="origin-top-left rounded-[1.8rem] bg-white"
        style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})` }}
      />
    </div>
  );
}

/**
 * Mostra o cardápio público dentro de um celular, ao lado das configurações.
 * `version` muda a cada alteração salva e recarrega a prévia.
 */
export function StorefrontPreview({ slug, version }: { slug: string; version: number }) {
  const [reloads, setReloads] = useState(0);
  const [open, setOpen] = useState(false);
  const src = `/${slug}?previa=${version}-${reloads}`;
  const title = "Prévia do seu cardápio";

  return (
    <>
      {/* Computador: celular fixo ao lado. */}
      <aside className="hidden lg:block">
        <div className="sticky top-[150px]">
          <div className="mb-3 flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4 text-[#2f5d50]" /> Prévia no celular
            </p>
            <button
              type="button"
              onClick={() => setReloads(n => n + 1)}
              className="flex items-center gap-1 text-xs font-semibold text-[#526d58] underline"
            >
              <RotateCw className="h-3 w-3" /> Recarregar
            </button>
          </div>
          <PhoneFrame key={src} src={src} scale={0.72} title={title} />
          <p className="mt-3 text-center text-xs text-[#9a9185]">
            A prévia atualiza sempre que você salva uma mudança.
          </p>
        </div>
      </aside>

      {/* Celular e tablet: botão que abre a prévia em tela cheia. */}
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 h-12 rounded-full bg-[#2f5d50] px-5 text-white shadow-xl hover:bg-[#254a40] lg:hidden"
      >
        <Eye className="mr-2 h-4 w-4" /> Ver prévia
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 bg-[#1f1b16] p-0 sm:max-w-none"
        >
          <div className="flex h-12 shrink-0 items-center justify-between px-4 text-white">
            <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar prévia"
              className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {open && <iframe key={src} title={title} src={src} className="w-full flex-1 bg-white" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
