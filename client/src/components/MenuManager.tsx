import { useRef, useState } from "react";
import { Check, ChevronsUpDown, ImagePlus, Loader2, Pencil, Plus, Trash2, Utensils, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { RecipeEditor, parseRecipeDraft, toRecipeDraft, type RecipeDraftLine } from "@/components/RecipeEditor";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Form = { id?: number; name: string; description: string; price: string; categoryId: string; imageUrl: string | null; active: boolean; featured: boolean };
const emptyForm: Form = { name: "", description: "", price: "", categoryId: "", imageUrl: null, active: true, featured: false };

const money = (value: string | number) => `R$ ${Number(value).toFixed(2).replace(".", ",")}`;
function parsePrice(text: string): number | null {
  const normalized = text.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

/** Cadastro real do cardápio: pratos, preços, categorias, fotos e disponibilidade. */
export function MenuManager() {
  const utils = trpc.useUtils();
  const company = trpc.company.mine.useQuery();
  const items = trpc.adminMenu.list.useQuery();
  const categories = trpc.adminMenu.categories.useQuery();
  const recipes = trpc.recipes.list.useQuery(undefined, { retry: false });
  const saveRecipe = trpc.recipes.save.useMutation();
  const [form, setForm] = useState<Form | null>(null);
  const [recipe, setRecipe] = useState<RecipeDraftLine[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<{ id: number; name: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = () => Promise.all([utils.adminMenu.list.invalidate(), utils.menu.list.invalidate()]);
  const createCategory = trpc.adminMenu.createCategory.useMutation();
  const createItem = trpc.adminMenu.create.useMutation();
  const updateItem = trpc.adminMenu.update.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });
  const deleteItem = trpc.adminMenu.delete.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Item excluído."); setToDelete(null); },
    onError: (e) => toast.error(e.message),
  });

  const categoryName = (id: number) => categories.data?.find((c) => c.id === id)?.name ?? "Sem categoria";
  const set = (patch: Partial<Form>) => setForm((current) => (current ? { ...current, ...patch } : current));

  const openNew = () => { setRecipe([]); setForm({ ...emptyForm, categoryId: categories.data?.[0] ? String(categories.data[0].id) : "" }); };
  const openEdit = (item: NonNullable<typeof items.data>[number]) => {
    setRecipe((recipes.data ?? []).filter((line) => Number(line.menuItemId) === item.id).map(toRecipeDraft));
    setForm({
      id: item.id, name: item.name, description: item.description ?? "", price: Number(item.price).toFixed(2).replace(".", ","),
      categoryId: String(item.categoryId), imageUrl: item.imageUrl, active: item.active, featured: item.featured,
    });
  };

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !company.data) return;
    if (!file.type.startsWith("image/")) return void toast.error("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
    if (file.size > MAX_IMAGE_BYTES) return void toast.error("A imagem passa de 5 MB. Escolha uma menor.");
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `${company.data.id}/menu-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, { cacheControl: "3600", contentType: file.type });
      if (error) throw error;
      set({ imageUrl: supabase.storage.from("logos").getPublicUrl(path).data.publicUrl });
    } catch (error) {
      toast.error(error instanceof Error ? `Não foi possível enviar a foto: ${error.message}. Rode o arquivo supabase-storage.sql no Supabase (veja o SETUP.md, seção 6).` : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form) return;
    const price = parsePrice(form.price);
    if (form.name.trim().length < 2) return void toast.error("Informe o nome do item.");
    if (price === null) return void toast.error("Informe um preço válido, por exemplo 24,90.");
    if (!form.categoryId) return void toast.error("Escolha uma categoria.");
    const recipeLines = parseRecipeDraft(recipe);
    if (!recipeLines) return;
    setSaving(true);
    try {
      const categoryId = Number(form.categoryId);
      const data = { categoryId, name: form.name.trim(), description: form.description.trim() || null, price, imageUrl: form.imageUrl, active: form.active, featured: form.featured };
      let itemId = form.id;
      if (itemId) await updateItem.mutateAsync({ id: itemId, data });
      else itemId = (await createItem.mutateAsync(data)).id;
      await saveRecipe.mutateAsync({ menuItemId: itemId, lines: recipeLines });
      await Promise.all([refresh(), utils.adminMenu.categories.invalidate(), utils.recipes.list.invalidate()]);
      toast.success(form.id ? "Item atualizado." : "Item adicionado ao cardápio.");
      setForm(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const loading = items.isLoading || categories.isLoading;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="metric-icon"><Utensils className="h-4 w-4" /></div>
            <div>
              <CardTitle className="font-display text-xl">Gestão de cardápio</CardTitle>
              <p className="mt-1 text-sm text-[#776e63]">Cadastre itens, preços, fotos e disponibilidade em poucos cliques.</p>
            </div>
          </div>
          <Button onClick={openNew} disabled={loading} className="rounded-xl bg-[#a05c32] text-white hover:bg-[#8a4e2b]"><Plus className="mr-2 h-4 w-4" />Adicionar item</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="h-20 animate-pulse rounded-xl bg-[#f1ece3]" />}
        {(items.error || categories.error) && <p className="rounded-xl bg-[#fff0d7] p-4 text-sm text-[#a05c32]">Não foi possível carregar o cardápio. {items.error?.message ?? categories.error?.message}</p>}
        {!loading && !items.error && items.data?.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#e5e0d7] p-8 text-center">
            <Utensils className="mx-auto h-8 w-8 text-[#c9b9a6]" />
            <p className="mt-3 font-semibold">Seu cardápio está vazio</p>
            <p className="mt-1 text-sm text-[#776e63]">Clique em “Adicionar item” para cadastrar o primeiro produto.</p>
          </div>
        )}
        {items.data?.map((item) => (
          <div key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-[#eeeae3] p-3 sm:flex-nowrap sm:gap-4">
            {item.imageUrl
              ? <img src={item.imageUrl} alt={item.name} className="h-14 w-14 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16" />
              : <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[#f1ece3] text-[#c9b9a6] sm:h-16 sm:w-16"><ImagePlus className="h-5 w-5" /></div>}
            <div className="min-w-0 flex-1 basis-[calc(100%-4.5rem)] sm:basis-auto">
              <p className="line-clamp-2 font-semibold leading-snug">{item.name}</p>
              <p className="mt-0.5 text-sm text-[#776e63]"><span className="whitespace-nowrap font-semibold text-[#29251f]">{money(item.price)}</span> · {categoryName(item.categoryId)}</p>
              {item.featured && <Badge className="mt-1 border-0 bg-[#fff0d7] text-[#a05c32]">Destaque</Badge>}
            </div>
            <div className="flex w-full items-center justify-end gap-2 border-t border-[#f1ece3] pt-2 sm:w-auto sm:border-0 sm:pt-0">
              <span className="mr-auto text-xs text-[#776e63] sm:hidden">{item.active ? "Disponível" : "Oculto"}</span>
              <span className="hidden text-xs text-[#776e63] sm:inline">{item.active ? "Disponível" : "Oculto"}</span>
              <Switch checked={item.active} onCheckedChange={(active) => updateItem.mutate({ id: item.id, data: { active } })} aria-label={`Disponibilidade de ${item.name}`} />
              <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label={`Editar ${item.name}`}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setToDelete({ id: item.id, name: item.name })} aria-label={`Excluir ${item.name}`}><Trash2 className="h-4 w-4 text-[#b4452f]" /></Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={form !== null} onOpenChange={(open) => !open && !saving && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{form?.id ? "Editar item" : "Novo item"}</DialogTitle>
            <DialogDescription>Preencha os dados que aparecem no seu cardápio online.</DialogDescription>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div>
                <label className="field-label">Foto</label>
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                {form.imageUrl ? (
                  <div className="relative">
                    <img src={form.imageUrl} alt="Prévia da foto" className="h-44 w-full rounded-xl object-cover" />
                    <button type="button" onClick={() => set({ imageUrl: null })} className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 shadow" aria-label="Remover foto"><X className="h-4 w-4" /></button>
                    <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()} className="absolute bottom-2 right-2">{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Trocar foto</Button>
                  </div>
                ) : (
                  <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#d9c9b7] bg-[#fbfaf7] text-sm text-[#776e63] hover:bg-[#f7f2ea]">
                    {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                    {uploading ? "Enviando…" : "Clique para enviar uma foto (até 5 MB)"}
                  </button>
                )}
              </div>
              <div>
                <label className="field-label" htmlFor="menu-name">Nome</label>
                <Input id="menu-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex.: Nome do produto" maxLength={160} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="menu-price">Preço (R$)</label>
                  <Input id="menu-price" inputMode="decimal" value={form.price} onChange={(e) => set({ price: e.target.value })} placeholder="24,90" />
                </div>
                <div>
                  <label className="field-label">Categoria</label>
                  <CategoryPicker
                    categories={categories.data ?? []}
                    value={form.categoryId}
                    onChange={(categoryId) => set({ categoryId })}
                    onCreate={async (name) => {
                      const created = await createCategory.mutateAsync({ name });
                      await utils.adminMenu.categories.invalidate();
                      return String(created.id);
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="menu-desc">Descrição</label>
                <Textarea id="menu-desc" value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={1000} placeholder="O que vem no item, tamanho, ingredientes…" />
              </div>
              <div>
                <label className="field-label">O que vai neste item</label>
                <p className="mb-2 text-xs text-[#776e63]">Quanto de cada ingrediente vai em 1 porção. Isso monta sua lista de compras em Estoque e produção.</p>
                <RecipeEditor lines={recipe} onChange={setRecipe} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#eeeae3] p-3">
                <div><p className="text-sm font-semibold">Disponível no cardápio</p><p className="text-xs text-[#776e63]">Desmarque para ocultar sem excluir.</p></div>
                <Switch checked={form.active} onCheckedChange={(active) => set({ active })} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#eeeae3] p-3">
                <div><p className="text-sm font-semibold">Destaque</p><p className="text-xs text-[#776e63]">Marca o item como favorito da casa.</p></div>
                <Switch checked={form.featured} onCheckedChange={(featured) => set({ featured })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setForm(null)}>Cancelar</Button>
            <Button disabled={saving || uploading} onClick={save} className="bg-[#a05c32] text-white hover:bg-[#8a4e2b]">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir “{toDelete?.name}”?</DialogTitle>
            <DialogDescription>O item some do cardápio. Pedidos antigos continuam no histórico. Se preferir, apenas oculte o item.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button disabled={deleteItem.isPending} onClick={() => toDelete && deleteItem.mutate({ id: toDelete.id })} className="bg-[#b4452f] text-white hover:bg-[#9a3a26]">Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** Uma única lista: escolhe uma categoria existente ou digita um nome novo e cria ali mesmo. */
function CategoryPicker({ categories, value, onChange, onCreate }: {
  categories: Array<{ id: number; name: string }>;
  value: string;
  onChange: (id: string) => void;
  onCreate: (name: string) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const selected = categories.find((c) => String(c.id) === value);
  const text = query.trim();
  const visible = categories.filter((c) => c.name.toLowerCase().includes(text.toLowerCase()));
  const canCreate = text.length >= 2 && !categories.some((c) => c.name.toLowerCase() === text.toLowerCase());

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery(""); };
  const create = async () => {
    setCreating(true);
    try { pick(await onCreate(text)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a categoria."); }
    finally { setCreating(false); }
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }} modal>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between rounded-md border-[#e5e0d7] bg-[#f7f2ea] font-normal">
          <span className={selected ? "truncate" : "truncate text-[#a79b8d]"}>{selected?.name ?? "Escolha"}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Buscar ou criar categoria…" maxLength={120} />
          <CommandList>
            {visible.length === 0 && !canCreate && <CommandEmpty>Digite o nome da categoria.</CommandEmpty>}
            <CommandGroup>
              {visible.map((c) => (
                <CommandItem key={c.id} value={String(c.id)} onSelect={() => pick(String(c.id))}>
                  <Check className={`mr-2 h-4 w-4 ${String(c.id) === value ? "opacity-100" : "opacity-0"}`} />{c.name}
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem value="__create__" disabled={creating} onSelect={create} className="text-[#a05c32]">
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Criar “{text}”
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
