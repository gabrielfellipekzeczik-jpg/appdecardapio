import { useParams } from "wouter";
import { Utensils } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useStorefront } from "@/lib/useStorefront";
import { ClassicTemplate } from "@/storefront-templates/ClassicTemplate";
import { ModernTemplate } from "@/storefront-templates/ModernTemplate";
import { CoverTemplate } from "@/storefront-templates/CoverTemplate";

const TEMPLATES = { classic: ClassicTemplate, modern: ModernTemplate, cover: CoverTemplate };

export default function Home() {
  const { slug = "" } = useParams<{ slug: string }>();
  const storefront = useStorefront(slug);
  const { company, companyQuery } = storefront;

  if (companyQuery.isLoading) return <div className="flex min-h-screen items-center justify-center bg-[#fbfaf7]"><p className="text-sm text-[#776e63]">Carregando...</p></div>;
  if (!company) return <div className="flex min-h-screen items-center justify-center bg-[#fbfaf7] px-6"><Card className="max-w-md border-0 text-center shadow-xl"><CardContent className="p-8"><Utensils className="mx-auto h-10 w-10 text-[#a05c32]" /><h1 className="mt-4 font-display text-2xl font-bold">Restaurante não encontrado</h1><p className="mt-2 text-sm text-[#776e63]">Confira o endereço ou peça o link direto pro restaurante.</p></CardContent></Card></div>;
  if (company.status !== "active") return <div className="flex min-h-screen items-center justify-center bg-[#fbfaf7] px-6"><Card className="max-w-md border-0 text-center shadow-xl"><CardContent className="p-8"><Utensils className="mx-auto h-10 w-10 text-[#a05c32]" /><h1 className="mt-4 font-display text-2xl font-bold">{company.name}</h1><p className="mt-2 text-sm text-[#776e63]">Esta loja está temporariamente indisponível.</p></CardContent></Card></div>;

  const Template = TEMPLATES[company.templateId] ?? ClassicTemplate;
  return <Template {...storefront} />;
}
