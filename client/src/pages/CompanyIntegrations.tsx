import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { WhatsappBotCard } from "@/components/WhatsappBotCard";
import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft,
  Bike,
  CircleAlert,
  Link2,
  LockKeyhole,
  ShieldCheck,
  Truck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/lib/usePageTitle";

type DeliveryOption = "uber_direct" | "lalamove" | "own_courier";

export default function CompanyIntegrations() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading, isAuthenticated } = useAuth();
  const companyQuery = trpc.company.mine.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  usePageTitle(
    companyQuery.data?.name && `Integrações · ${companyQuery.data.name}`
  );
  const statusQuery = trpc.integrations.status.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 10_000,
  });
  const connectUrlQuery = trpc.integrations.mercadoPagoConnectUrl.useQuery(
    undefined,
    { enabled: false }
  );
  const updateBrandingMutation = trpc.company.updateBranding.useMutation({
    onSuccess: () => {
      toast.success("Endereço salvo.");
      companyQuery.refetch();
    },
    onError: e => toast.error(e.message),
  });
  const setDeliveryMutation = trpc.integrations.setDeliveryProvider.useMutation(
    {
      onSuccess: () => {
        toast.success("Entrega configurada.");
        statusQuery.refetch();
      },
      onError: e => toast.error(e.message),
    }
  );

  const [pickupAddress, setPickupAddress] = useState("");
  const [addressValid, setAddressValid] = useState(true);
  const [openDeliveryForm, setOpenDeliveryForm] =
    useState<DeliveryOption | null>(null);
  const [uberFields, setUberFields] = useState({
    clientId: "",
    clientSecret: "",
    customerId: "",
  });
  const [lalamoveFields, setLalamoveFields] = useState({
    apiKey: "",
    apiSecret: "",
  });
  const [courierFields, setCourierFields] = useState({
    name: "",
    phone: "",
    pricePerKm: "",
    pickupLatitude: "",
    pickupLongitude: "",
  });
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (companyQuery.data?.pickupAddress) {
      setPickupAddress(companyQuery.data.pickupAddress);
    }
  }, [companyQuery.data]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mercadopago") === "connected") {
      toast.success("Mercado Pago conectado com sucesso.");
      statusQuery.refetch();
    }
    if (params.get("mercadopago") === "error")
      toast.error("Não foi possível conectar o Mercado Pago. Tente novamente.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectMercadoPago = async () => {
    const { data, error } = await connectUrlQuery.refetch();
    if (data?.url) window.location.href = data.url;
    else
      toast.error(
        error?.message ?? "Configure o Mercado Pago no servidor primeiro."
      );
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[#f7f6f2] p-8">
        <div className="mx-auto max-w-6xl animate-pulse rounded-3xl bg-white p-12">
          <div className="h-8 w-72 rounded bg-[#eeeae3]" />
        </div>
      </div>
    );
  if (!isAuthenticated || user?.role !== "admin")
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f6f2] px-6">
        <Card className="max-w-md border-0 text-center shadow-xl">
          <CardContent className="p-8">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#a05c32]" />
            <h1 className="mt-4 font-display text-2xl font-bold">
              Acesso restrito
            </h1>
            <Link href="/admin-login">
              <Button className="mt-5 rounded-xl bg-[#2f5d50] text-white">
                Entrar
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );

  const status = statusQuery.data;
  const mpConnected = status?.mercadopago.connected ?? false;
  const mpConfigured = status?.mercadopago.configured ?? false;
  const activeDelivery: DeliveryOption | null = status?.uberDirect.connected
    ? "uber_direct"
    : status?.lalamove.connected
      ? "lalamove"
      : status?.ownCourier.connected
        ? "own_courier"
        : null;

  const deliveryCards: Array<{
    key: DeliveryOption;
    name: string;
    tag: string;
    icon: typeof Truck;
  }> = [
    {
      key: "uber_direct",
      name: "Uber Direct",
      tag: "cobre todo o Brasil",
      icon: Truck,
    },
    {
      key: "lalamove",
      name: "Lalamove",
      tag: "ideal para entregas pequenas",
      icon: Bike,
    },
    {
      key: "own_courier",
      name: "Motoboy próprio",
      tag: "seu entregador fixo",
      icon: Bike,
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f6f2] text-[#29251f]">
      <header className="border-b border-[#e5e0d7] bg-[#fbfaf7]">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="brand-mark">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display text-xl font-bold">Integrações</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a05c32]">
                {companyQuery.data?.name}
              </p>
            </div>
          </div>
          <Link href={`/${slug}/admin`}>
            <Button
              variant="outline"
              className="rounded-xl border-[#e5e0d7] bg-white"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel
            </Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 lg:px-8">
        <div className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Pagamento e entrega
          </h1>
          <p className="mt-3 max-w-2xl leading-7 text-[#776e63]">
            Conecte o Mercado Pago pra receber pelo app e escolha como suas
            entregas são despachadas.
          </p>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-4">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: "#61a87d20", color: "#61a87d" }}
                >
                  <WalletCards className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="font-display text-xl">
                      Mercado Pago
                    </CardTitle>
                    <Badge
                      className={
                        mpConnected
                          ? "border-0 bg-[#e2f1e7] text-[#347052]"
                          : "border-0 bg-[#fff0d7] text-[#a05c32]"
                      }
                    >
                      {mpConnected ? "Conectado" : "Não conectado"}
                    </Badge>
                  </div>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-[#776e63]">
                    Conecte sua conta pra receber Pix, crédito e débito direto
                    pelo checkout.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-5" />
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <p className="flex items-center gap-2 text-xs text-[#a79b8d]">
                  <LockKeyhole className="h-3.5 w-3.5" /> A conexão é feita
                  direto no site do Mercado Pago — não vemos sua senha.
                </p>
                <Button
                  onClick={connectMercadoPago}
                  disabled={!mpConfigured || connectUrlQuery.isFetching}
                  className="rounded-xl bg-[#2f5d50] text-white hover:bg-[#254a40]"
                >
                  <Link2 className="mr-2 h-4 w-4" />{" "}
                  {mpConnected ? "Reconectar" : "Conectar com Mercado Pago"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
            <CardHeader>
              <CardTitle className="font-display text-xl">
                Endereço de retirada
              </CardTitle>
              <p className="text-sm text-[#776e63]">
                Usado pelo entregador pra saber onde buscar o pedido.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-2">
                <AddressAutocomplete
                  value={pickupAddress}
                  onChange={setPickupAddress}
                  onValidChange={setAddressValid}
                />
                <Button
                  onClick={() =>
                    updateBrandingMutation.mutate({ pickupAddress })
                  }
                  disabled={
                    pickupAddress.length < 5 ||
                    !addressValid ||
                    updateBrandingMutation.isPending
                  }
                  className="rounded-xl bg-[#2f5d50] text-white"
                >
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-0 shadow-[0_8px_35px_rgba(67,48,32,0.05)]">
            <CardHeader>
              <CardTitle className="font-display text-xl">Entrega</CardTitle>
              <p className="text-sm text-[#776e63]">
                Escolha um provedor. Ao marcar o pedido como "pronto", a corrida
                é acionada sozinha (exceto motoboy próprio).
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {deliveryCards.map(({ key, name, tag, icon: Icon }) => (
                <div
                  key={key}
                  className={`rounded-2xl border p-4 ${activeDelivery === key ? "border-[#2f5d50] bg-[#e2f1e7]/40" : "border-[#e5e0d7]"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-[#a05c32]" />
                      <div>
                        <p className="font-semibold">{name}</p>
                        <p className="text-xs text-[#776e63]">{tag}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeDelivery === key && (
                        <Badge className="border-0 bg-[#347052] text-white">
                          Ativo
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setOpenDeliveryForm(
                            openDeliveryForm === key ? null : key
                          )
                        }
                        className="rounded-lg"
                      >
                        {activeDelivery === key ? "Editar" : "Configurar"}
                      </Button>
                    </div>
                  </div>
                  {openDeliveryForm === key && (
                    <div className="mt-4 space-y-3 border-t border-[#e5e0d7] pt-4">
                      {key === "uber_direct" && (
                        <>
                          <Input
                            placeholder="Client ID"
                            value={uberFields.clientId}
                            onChange={e =>
                              setUberFields({
                                ...uberFields,
                                clientId: e.target.value,
                              })
                            }
                          />
                          <Input
                            type={showSecret.uber ? "text" : "password"}
                            placeholder="Client Secret"
                            value={uberFields.clientSecret}
                            onChange={e =>
                              setUberFields({
                                ...uberFields,
                                clientSecret: e.target.value,
                              })
                            }
                          />
                          <Input
                            placeholder="Customer ID"
                            value={uberFields.customerId}
                            onChange={e =>
                              setUberFields({
                                ...uberFields,
                                customerId: e.target.value,
                              })
                            }
                          />
                          <Button
                            onClick={() =>
                              setDeliveryMutation.mutate({
                                provider: "uber_direct",
                                ...uberFields,
                              })
                            }
                            disabled={
                              !uberFields.clientId ||
                              !uberFields.clientSecret ||
                              !uberFields.customerId
                            }
                            className="rounded-xl bg-[#2f5d50] text-white"
                          >
                            Salvar
                          </Button>
                        </>
                      )}
                      {key === "lalamove" && (
                        <>
                          <Input
                            placeholder="API Key"
                            value={lalamoveFields.apiKey}
                            onChange={e =>
                              setLalamoveFields({
                                ...lalamoveFields,
                                apiKey: e.target.value,
                              })
                            }
                          />
                          <Input
                            type={showSecret.lalamove ? "text" : "password"}
                            placeholder="API Secret"
                            value={lalamoveFields.apiSecret}
                            onChange={e =>
                              setLalamoveFields({
                                ...lalamoveFields,
                                apiSecret: e.target.value,
                              })
                            }
                          />
                          <Button
                            onClick={() =>
                              setDeliveryMutation.mutate({
                                provider: "lalamove",
                                ...lalamoveFields,
                              })
                            }
                            disabled={
                              !lalamoveFields.apiKey ||
                              !lalamoveFields.apiSecret
                            }
                            className="rounded-xl bg-[#2f5d50] text-white"
                          >
                            Salvar
                          </Button>
                        </>
                      )}
                      {key === "own_courier" && (
                        <>
                          <Input
                            placeholder="Nome do motoboy"
                            value={courierFields.name}
                            onChange={e =>
                              setCourierFields({
                                ...courierFields,
                                name: e.target.value,
                              })
                            }
                          />
                          <Input
                            placeholder="Telefone"
                            value={courierFields.phone}
                            onChange={e =>
                              setCourierFields({
                                ...courierFields,
                                phone: e.target.value,
                              })
                            }
                          />
                          <label className="block text-sm font-medium text-[#414941]">
                            Valor por km rodoviário
                            <Input
                              className="mt-2"
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="Ex.: 2,50"
                              value={courierFields.pricePerKm}
                              onChange={e =>
                                setCourierFields({
                                  ...courierFields,
                                  pricePerKm: e.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-[#414941]">
                              Latitude da retirada
                              <Input
                                className="mt-2"
                                type="number"
                                min="-90"
                                max="90"
                                step="any"
                                placeholder="Ex.: -23.550520"
                                value={courierFields.pickupLatitude}
                                onChange={e =>
                                  setCourierFields({
                                    ...courierFields,
                                    pickupLatitude: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="block text-sm font-medium text-[#414941]">
                              Longitude da retirada
                              <Input
                                className="mt-2"
                                type="number"
                                min="-180"
                                max="180"
                                step="any"
                                placeholder="Ex.: -46.633308"
                                value={courierFields.pickupLongitude}
                                onChange={e =>
                                  setCourierFields({
                                    ...courierFields,
                                    pickupLongitude: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <p className="text-xs leading-5 text-[#776e63]">
                            O app calcula a rota de carro entre estas
                            coordenadas e o endereço do cliente e multiplica
                            pelos R$/km configurados.
                          </p>
                          <p className="text-xs text-[#a79b8d]">
                            Ativa o rastreamento GPS por link privado para o
                            motoboy. A entrega é confirmada pelo cliente com os
                            4 últimos dígitos do telefone.
                          </p>
                          <Button
                            onClick={() =>
                              setDeliveryMutation.mutate({
                                provider: "own_courier",
                                name: courierFields.name,
                                phone: courierFields.phone,
                                pricePerKm: Number(courierFields.pricePerKm),
                                pickupLatitude: Number(
                                  courierFields.pickupLatitude
                                ),
                                pickupLongitude: Number(
                                  courierFields.pickupLongitude
                                ),
                              })
                            }
                            disabled={
                              !courierFields.name ||
                              !courierFields.phone ||
                              !courierFields.pricePerKm ||
                              !courierFields.pickupLatitude ||
                              !courierFields.pickupLongitude
                            }
                            className="rounded-xl bg-[#2f5d50] text-white"
                          >
                            Salvar
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div className="rounded-2xl border border-[#e5e0d7] bg-[#f7f6f2] p-4 opacity-70">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-[#776e63]" />
                  <div>
                    <p className="font-semibold">99 (entregas grandes)</p>
                    <p className="text-xs text-[#776e63]">
                      {status?.ninetyNineDelivery.reason}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <WhatsappBotCard />
        </div>

        <Card className="mt-8 border-0 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-[#fff0d7] p-2 text-[#a05c32]">
                <CircleAlert className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold">Antes de publicar</p>
                <p className="mt-1 text-sm leading-6 text-[#776e63]">
                  Teste primeiro em ambiente sandbox de cada provedor.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
