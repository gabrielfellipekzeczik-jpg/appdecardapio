import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, ImagePlus, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { extractDominantColor } from "@/lib/color";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";

const TEMPLATE_OPTIONS = [
  { id: "premium" as const, name: "Bistrô", description: "Escuro e elegante, com foto de fundo, categorias na lateral e carrinho sempre visível. Tem alternância claro/escuro." },
  { id: "cover" as const, name: "Capa de cardápio", description: "Capa com sua logo que abre com uma animação, revelando o cardápio por dentro." },
  { id: "classic" as const, name: "Clássico", description: "Editorial, aconchegante — fotos grandes e seções de história." },
  { id: "modern" as const, name: "Moderno", description: "Minimalista, direto ao ponto — lista compacta e cor de marca em destaque." },
];

/** Logo, foto de fundo, nome, cor de marca e escolha de modelo da página pública da empresa. */
export function AppearancePanel() {
  const companyQuery = trpc.company.mine.useQuery();
  const utils = trpc.useUtils();
  const updateMutation = trpc.company.updateBranding.useMutation({
    onSuccess: () => { utils.company.mine.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#a05c32");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyQuery.data) return;
    setName(companyQuery.data.name);
    setTagline(companyQuery.data.tagline ?? "");
    setPrimaryColor(companyQuery.data.primaryColor ?? "#a05c32");
  }, [companyQuery.data]);

  const company = companyQuery.data;

  async function uploadImage(file: File, prefix: "logo" | "hero"): Promise<string> {
    const path = `${company!.id}/${prefix}-${Date.now()}.${file.name.split(".").pop() ?? "png"}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true, cacheControl: "3600" });
    if (uploadError) throw uploadError;
    return supabase.storage.from("logos").getPublicUrl(path).data.publicUrl;
  }

  const handleLogoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !company) return;
    setUploadingLogo(true);
    try {
      const publicUrl = await uploadImage(file, "logo");
      const extractedColor = await extractDominantColor(publicUrl);
      await updateMutation.mutateAsync({ logoUrl: publicUrl, ...(extractedColor ? { primaryColor: extractedColor } : {}) });
      if (extractedColor) setPrimaryColor(extractedColor);
      toast.success(extractedColor ? "Logo atualizada — cor da capa ajustada pra combinar." : "Logo atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a logo. Verifique se o bucket \"logos\" existe no Supabase Storage.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleHeroChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !company) return;
    setUploadingHero(true);
    try {
      const publicUrl = await uploadImage(file, "hero");
      await updateMutation.mutateAsync({ heroImageUrl: publicUrl });
      toast.success("Foto de fundo atualizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a foto.");
    } finally {
      setUploadingHero(false);
      if (heroInputRef.current) heroInputRef.current.value = "";
    }
  };

  if (companyQuery.isLoading || !company) return <div className="animate-pulse rounded-2xl bg-white p-8"><div className="h-6 w-48 rounded bg-[#eeeae3]" /></div>;

  return (
    <div className="space-y-5">
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="font-display text-xl">Identidade visual</CardTitle><p className="mt-1 text-sm text-[#776e63]">Nome, logo e cor que aparecem no seu cardápio.</p></div>
          <a href={`/${company.slug}`} target="_blank" rel="noreferrer"><Button variant="outline" size="sm" className="rounded-lg"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Ver meu cardápio</Button></a>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            {company.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-16 w-16 rounded-2xl object-cover" /> : <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f1ece3] text-xs text-[#a79b8d]">sem logo</div>}
            <div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <Button variant="outline" size="sm" disabled={uploadingLogo} onClick={() => logoInputRef.current?.click()} className="rounded-lg">
                {uploadingLogo ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1.5 h-3.5 w-3.5" />} {uploadingLogo ? "Enviando..." : "Enviar logo"}
              </Button>
              <p className="mt-1 text-xs text-[#a79b8d]">PNG ou JPG, fundo transparente funciona melhor.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {company.heroImageUrl ? <img src={company.heroImageUrl} alt="Foto de fundo" className="h-16 w-28 rounded-2xl object-cover" /> : <div className="flex h-16 w-28 items-center justify-center rounded-2xl bg-[#f1ece3] text-xs text-[#a79b8d]">sem foto</div>}
            <div>
              <input ref={heroInputRef} type="file" accept="image/*" className="hidden" onChange={handleHeroChange} />
              <Button variant="outline" size="sm" disabled={uploadingHero} onClick={() => heroInputRef.current?.click()} className="rounded-lg">
                {uploadingHero ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="mr-1.5 h-3.5 w-3.5" />} {uploadingHero ? "Enviando..." : "Enviar foto de fundo"}
              </Button>
              <p className="mt-1 text-xs text-[#a79b8d]">Foto do salão/prato pra capa do modelo Bistrô. Uma foto horizontal e escura funciona melhor.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="field-label">Nome do restaurante</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><label className="field-label">Cor de marca</label><div className="flex items-center gap-2"><input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-[#e5e0d7]" /><Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1" /></div></div>
          </div>
          <div><label className="field-label">Frase de efeito (opcional)</label><Textarea value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Ex.: comida de verdade" className="min-h-16" /></div>
          <Button onClick={() => updateMutation.mutate({ name, tagline, primaryColor })} disabled={name.length < 2 || updateMutation.isPending} className="rounded-xl bg-[#2f5d50] text-white"><Save className="mr-2 h-4 w-4" /> Salvar</Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="font-display text-xl">Modelo da página</CardTitle><p className="mt-1 text-sm text-[#776e63]">Escolha o layout do seu cardápio público.</p></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {TEMPLATE_OPTIONS.map((template) => (
            <button key={template.id} onClick={() => updateMutation.mutate({ templateId: template.id })} className={`rounded-2xl border p-4 text-left transition ${company.templateId === template.id ? "border-[#2f5d50] bg-[#e2f1e7]/40" : "border-[#e5e0d7] hover:border-[#cdbfae]"}`}>
              <div className="flex items-center justify-between"><p className="font-semibold">{template.name}</p>{company.templateId === template.id && <Check className="h-4 w-4 text-[#347052]" />}</div>
              <p className="mt-1 text-sm text-[#776e63]">{template.description}</p>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
