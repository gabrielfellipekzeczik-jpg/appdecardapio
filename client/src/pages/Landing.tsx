import { ArrowRight, CreditCard, Truck, Utensils } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: Utensils, title: "Seu cardápio, sua cara", text: "Cada restaurante tem sua própria página de pedidos, com nome, logo e cores." },
  { icon: CreditCard, title: "Receba na hora", text: "Conecte sua conta do Mercado Pago e receba Pix, crédito e débito direto no app." },
  { icon: Truck, title: "Entrega automática", text: "Escolha Uber Direct, Lalamove ou seu motoboy próprio — sem planilha, sem ligação." },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#29251f]">
      <header className="border-b border-[#e9e3d9]/80 bg-[#fbfaf7]/90">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="brand-mark"><Utensils className="h-5 w-5" /></div>
            <p className="font-display text-xl font-bold">Marmitaria Flow</p>
          </div>
          <Link href="/admin-login"><Button variant="ghost">Já tenho conta</Button></Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-20 text-center lg:px-8">
        <h1 className="font-display text-5xl font-bold tracking-tight sm:text-6xl">Seu restaurante, seu app de pedidos.</h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#776e63]">Cadastre sua marmitaria, monte seu cardápio e comece a vender em minutos — pagamento e entrega já integrados.</p>
        <Link href="/cadastrar"><Button size="lg" className="mt-9 h-13 rounded-full bg-[#a05c32] px-8 text-white hover:bg-[#8a4e2b]">Cadastrar meu restaurante <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-0 text-left shadow-sm">
              <CardContent className="p-6">
                <Icon className="h-6 w-6 text-[#a05c32]" />
                <h3 className="mt-4 font-display text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#776e63]">{text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
