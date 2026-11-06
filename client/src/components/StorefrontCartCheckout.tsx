import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Banknote,
  Bike,
  Check,
  ChevronRight,
  Copy,
  CreditCard,
  LockKeyhole,
  MailCheck,
  MapPin,
  MapPinned,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { MercadoPagoBrick } from "@/components/MercadoPagoBrick";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { supabase } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { OrderTrackingView } from "@/components/OrderTrackingView";
import { PendingPaymentPanel } from "@/components/PendingPaymentPanel";
import { paymentFailureMessage } from "@shared/payment-messages";
import { formatPhone, isSameEmail } from "@shared/store-rules";
import type { Storefront } from "@/lib/useStorefront";

type SavedAddress = {
  id: string;
  label: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  addressReference: string;
};
type CustomerProfile = {
  name?: string;
  phone?: string;
  addresses?: SavedAddress[];
};
const PROFILE_KEY = "marmitaria_checkout_profiles";
/** Guarda para qual e-mail o código saiu: o celular pode recarregar a aba enquanto o cliente abre a caixa de entrada. */
const codeSentKey = (slug: string) => `marmitaria-code-sent-${slug}`;
const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );

function profileFor(
  user: { user_metadata?: Record<string, unknown> },
  slug: string
): CustomerProfile {
  const all = (user.user_metadata?.[PROFILE_KEY] ?? {}) as Record<
    string,
    CustomerProfile
  >;
  return all[slug] ?? {};
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 flex items-center gap-2 text-xs font-semibold text-[#414941]">
        {label}
        {optional && (
          <span className="text-xs font-normal text-[#929991]">opcional</span>
        )}
      </span>
      {children}
    </label>
  );
}

export function StorefrontCartCheckout(s: Storefront) {
  const [pixQrExpanded, setPixQrExpanded] = useState(false);
  const liveTracking = trpc.tracking.customer.useQuery(
    { token: s.customerTrackingToken ?? "" },
    {
      enabled: Boolean(s.orderComplete && s.customerTrackingToken),
      refetchInterval: 10000,
      retry: false,
    }
  );
  const [showCard, setShowCard] = useState(false);
  const [showCash, setShowCash] = useState(false);
  const [changeFor, setChangeFor] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [openNotes, setOpenNotes] = useState<number[]>([]);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [codeSentTo, setCodeSentTo] = useState<string | null>(() =>
    sessionStorage.getItem(codeSentKey(s.slug))
  );
  const [emailCode, setEmailCode] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null
  );
  const accent = s.company?.primaryColor || "#2f5d50";
  const pendingPix = s.pendingPayment?.copyPaste;
  const pendingQr = s.pendingPayment?.qrCode;
  const pickup = s.fulfillment === "pickup";
  const fieldClass =
    "h-11 rounded-xl border border-[#e7e9e4] bg-[#f8f9f7] px-3 text-base shadow-none placeholder:text-[#9ba29a] focus-visible:border-[#71917c] focus-visible:ring-2 focus-visible:ring-[#71917c]/20 md:text-base";

  const typedEmail = s.customer.email.trim().toLowerCase();
  const emailVerified = Boolean(verifiedEmail) && verifiedEmail === typedEmail;
  const codeSent = !emailVerified && codeSentTo === typedEmail;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typedEmail);
  const emailsMatch = isSameEmail(s.customer.email, emailConfirmation);

  const applyProfile = (user: {
    email?: string;
    user_metadata?: Record<string, unknown>;
  }) => {
    const profile = profileFor(user, s.slug);
    const addresses = Array.isArray(profile.addresses) ? profile.addresses : [];
    setVerifiedEmail(user.email?.toLowerCase() ?? null);
    setSavedAddresses(addresses);
    setSelectedAddressId(addresses[0]?.id ?? null);
    s.setCustomer(current => ({
      ...current,
      name: current.name || profile.name || "",
      phone: current.phone || formatPhone(profile.phone ?? ""),
      email: user.email ?? current.email,
      ...(current.address ? {} : addresses[0] ? addresses[0] : {}),
    }));
  };

  useEffect(() => {
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (active && data.user?.email_confirmed_at) applyProfile(data.user);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [s.slug]);

  const setCustomerField = (key: string, value: string) =>
    s.setCustomer(current => ({ ...current, [key]: value }));

  const sendEmailCode = async () => {
    if (!emailValid) {
      setAuthError("Digite um e-mail válido.");
      return;
    }
    if (!emailsMatch) {
      setAuthError("Os dois e-mails precisam ser iguais.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: typedEmail,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      sessionStorage.setItem(codeSentKey(s.slug), typedEmail);
      setCodeSentTo(typedEmail);
      toast.success(`Enviamos um código para ${typedEmail}.`);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o código."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const correctEmail = () => {
    sessionStorage.removeItem(codeSentKey(s.slug));
    setCodeSentTo(null);
    setEmailCode("");
    setEmailConfirmation("");
    setAuthError("");
  };

  /** Salva nome, telefone e endereços na conta do comprador para a próxima compra. */
  const persistAccount = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    const user = data.user;
    if (!user?.email || user.email.toLowerCase() !== typedEmail) return;
    const current = user.user_metadata ?? {};
    const allProfiles = (current[PROFILE_KEY] ?? {}) as Record<
      string,
      CustomerProfile
    >;
    const existing = allProfiles[s.slug] ?? {};
    let addresses = Array.isArray(existing.addresses)
      ? existing.addresses
      : savedAddresses;
    const address = s.customer.address.trim();
    const addressNumber = s.customer.addressNumber.trim();
    if (!pickup && address && addressNumber) {
      const match = addresses.find(
        entry =>
          entry.id === selectedAddressId ||
          (entry.address === address && entry.addressNumber === addressNumber)
      );
      const record: SavedAddress = {
        id: match?.id ?? crypto.randomUUID(),
        label: address.split(",")[0]?.trim().slice(0, 40) || "Meu endereço",
        address,
        addressNumber,
        addressComplement: s.customer.addressComplement.trim(),
        addressReference: s.customer.addressReference.trim(),
      };
      addresses = [
        record,
        ...addresses.filter(entry => entry.id !== record.id),
      ].slice(0, 10);
      setSelectedAddressId(record.id);
    }
    const profile: CustomerProfile = {
      name: s.customer.name.trim(),
      phone: s.customer.phone.trim(),
      addresses,
    };
    const { error: saveError } = await supabase.auth.updateUser({
      data: { ...current, [PROFILE_KEY]: { ...allProfiles, [s.slug]: profile } },
    });
    if (saveError) throw saveError;
    setSavedAddresses(addresses);
  };

  /** Salvar o perfil é conveniência: uma falha aqui nunca impede o cliente de pagar. */
  const saveAccountQuietly = () =>
    persistAccount().catch(error =>
      console.warn("[checkout] perfil não salvo:", error)
    );

  const verifyEmail = async () => {
    if (!/^\d{6,8}$/.test(emailCode)) {
      setAuthError("Digite o código enviado por e-mail.");
      return;
    }
    setAuthBusy(true);
    setAuthError("");
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: typedEmail,
        token: emailCode,
        type: "email",
      });
      if (error) throw error;
      if (!data.user?.email_confirmed_at)
        throw new Error(
          "O e-mail ainda não foi confirmado. Verifique o código e tente novamente."
        );
      sessionStorage.removeItem(codeSentKey(s.slug));
      setCodeSentTo(null);
      setEmailCode("");
      applyProfile(data.user);
      void saveAccountQuietly();
      toast.success("E-mail confirmado. Seus dados ficam salvos para a próxima compra.");
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Não foi possível confirmar o e-mail."
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const useAnotherEmail = async () => {
    await supabase.auth.signOut().catch(() => undefined);
    correctEmail();
    setVerifiedEmail(null);
    setSavedAddresses([]);
    setSelectedAddressId(null);
    s.setCustomer(current => ({
      ...current,
      name: "",
      phone: "",
      email: "",
      address: "",
      addressNumber: "",
      addressComplement: "",
      addressReference: "",
    }));
  };

  const chooseAddress = (entry: SavedAddress) => {
    setSelectedAddressId(entry.id);
    s.setCustomer(current => ({
      ...current,
      address: entry.address,
      addressNumber: entry.addressNumber,
      addressComplement: entry.addressComplement,
      addressReference: entry.addressReference,
    }));
  };

  const submitPayment = async (
    formData: Parameters<Storefront["handleBrickSubmit"]>[0]
  ) => {
    s.setPaymentError("");
    try {
      await saveAccountQuietly();
      await s.handleBrickSubmit(formData);
    } catch (error) {
      s.reportPaymentFailure(paymentFailureMessage(error));
    }
  };

  const payWithPix = async () => {
    setPayBusy(true);
    try {
      await submitPayment({
        payment_method_id: "pix",
        payer: { email: s.customer.email.trim() },
      });
    } finally {
      setPayBusy(false);
    }
  };

  const confirmCashOrder = async () => {
    setPayBusy(true);
    s.setPaymentError("");
    try {
      await saveAccountQuietly();
      await s.placeCashOrder(changeFor);
    } catch (error) {
      s.reportPaymentFailure(paymentFailureMessage(error));
    } finally {
      setPayBusy(false);
    }
  };

  const copyPixCode = async () => {
    if (!pendingPix) return;
    try {
      await navigator.clipboard.writeText(pendingPix);
      toast.success("Código Pix copiado.");
    } catch {
      toast.error("Não foi possível copiar o código Pix neste dispositivo.");
    }
  };

  const toggleNote = (id: number) =>
    setOpenNotes(current =>
      current.includes(id)
        ? current.filter(value => value !== id)
        : [...current, id]
    );

  const trackingHref = s.customerTrackingToken
    ? `/rastrear/${encodeURIComponent(s.slug)}/${s.customerTrackingToken}`
    : null;
  const deliveryCode = s.customer.phone.replace(/\D/g, "").slice(-4);
  const contactComplete =
    s.customer.name.trim().length >= 2 &&
    s.customer.phone.replace(/\D/g, "").length >= 10;
  const addressComplete =
    pickup ||
    (s.customer.address.trim().length >= 5 &&
      s.customer.addressNumber.trim().length > 0);
  const canPayOnline = s.checkoutState.paymentEnabled;
  const quoteReady =
    !s.needsDeliveryQuote ||
    (!s.deliveryQuoteLoading && Boolean(s.deliveryQuote?.quoteToken));
  const nextCheckoutTarget =
    !emailVerified || !contactComplete
    ? "checkout-contact"
    : !addressComplete
      ? "checkout-address"
      : "checkout-payment";
  const nextCheckoutLabel = !s.storeStatus.open
    ? "Loja fechada"
    : !emailVerified
      ? "Confirmar e-mail"
      : !contactComplete
    ? "Preencher seus dados"
    : !addressComplete
      ? "Informar endereço"
      : "Ir para pagar";
  const readyToSubmit =
    nextCheckoutTarget === "checkout-payment" &&
    s.storeStatus.open &&
    quoteReady;
  const scrollToNextCheckoutStep = () =>
    document
      .getElementById(nextCheckoutTarget)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  const payOnArrival = pickup ? "na retirada" : "na entrega";
  const fixedAction =
    readyToSubmit && canPayOnline
      ? { label: "Pagar com Pix", run: payWithPix }
      : readyToSubmit && s.cashAvailable
        ? { label: "Finalizar pedido", run: confirmCashOrder }
        : { label: nextCheckoutLabel, run: scrollToNextCheckoutStep };

  return (
    <>
      <StoreBottomBar {...s} accent={accent} />
      <Sheet open={s.cartOpen} onOpenChange={s.setCartOpen}>
        <SheetContent
          side="right"
          className="!left-0 !right-auto !flex !h-[100dvh] !w-screen !max-w-none !flex-col !gap-0 !overflow-hidden !border-0 !p-0 !shadow-none [&>button:last-child]:hidden"
        >
          <div className="flex h-full min-h-0 flex-col bg-[#f4f5f1] text-[#252a26]">
            <header className="z-40 shrink-0 border-b border-[#e8ebe5] bg-white/95 backdrop-blur-xl">
              <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-4 sm:px-7 lg:px-10">
                <div className="flex min-w-0 items-center gap-3">
                  {s.company?.logoUrl ? (
                    <img
                      src={s.company.logoUrl}
                      alt=""
                      className="h-10 w-10 rounded-2xl object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm"
                      style={{ backgroundColor: accent }}
                    >
                      <ShoppingBag className="h-5 w-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {s.company?.name || "Sua loja"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#788078]">
                      <LockKeyhole className="h-3 w-3" /> Checkout seguro
                    </p>
                  </div>
                </div>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    className="h-10 rounded-full px-3 text-[#5f685f] hover:bg-[#f1f3ef] sm:px-4"
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Voltar à loja</span>
                    <span className="sm:hidden">Voltar</span>
                  </Button>
                </SheetClose>
                <SheetTitle className="sr-only">Finalizar pedido</SheetTitle>
              </div>
            </header>

            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              {s.orderComplete ? (
                <main className="mx-auto flex min-h-[75vh] max-w-2xl flex-col items-center justify-center px-5 py-12 text-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#e2f1e7] text-[#347052]">
                    <Check className="h-9 w-9" />
                  </div>
                  <h1 className="mt-6 font-display text-3xl font-bold">
                    Pedido confirmado!
                  </h1>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-[#737a73]">
                    {s.completedOrder?.payOnDelivery
                      ? `A loja já recebeu seu pedido. Pague ${money(s.completedOrder.total)} ${s.completedOrder.pickup ? "na retirada" : "na entrega"}, em dinheiro ou maquininha.`
                      : "O pagamento foi aprovado e a loja já recebeu seu pedido."}
                  </p>
                  {s.completedOrder?.pickup && s.company?.pickupAddress && (
                    <p className="mt-2 max-w-lg text-sm font-semibold text-[#414941]">
                      Retire em: {s.company.pickupAddress}
                    </p>
                  )}
                  {liveTracking.data ? (
                    <div className="mt-6 w-full text-left">
                      <OrderTrackingView tracking={liveTracking.data} />
                    </div>
                  ) : (
                    s.checkoutConfigQuery.data?.deliveryProvider ===
                      "own_courier" &&
                    !s.completedOrder?.pickup && (
                      <div className="mt-6 rounded-2xl border border-[#e4e8e1] bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#718477]">
                          Código para confirmar a entrega
                        </p>
                        <p className="mt-2 font-mono text-3xl font-bold tracking-[0.35em] text-[#2f5d50]">
                          {deliveryCode}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[#737a73]">
                          Informe este código ao motoboy somente quando receber
                          o pedido.
                        </p>
                      </div>
                    )
                  )}
                  <p className="mt-4 max-w-md text-xs leading-5 text-[#737a73]">
                    Para ver o andamento depois, abra{" "}
                    <strong>Meus pedidos</strong> e entre só com o seu e-mail.
                    Também enviamos os avisos por e-mail e WhatsApp quando a
                    loja os ativa.
                  </p>
                  <a
                    href={`/${s.slug}/pedidos`}
                    className="mt-2 text-sm font-semibold text-[#3e5e49] underline"
                  >
                    Meus pedidos
                  </a>
                  {trackingHref && (
                    <a
                      href={trackingHref}
                      className="mt-6 inline-flex h-12 items-center justify-center rounded-2xl px-6 font-semibold text-white shadow-sm"
                      style={{ backgroundColor: accent }}
                    >
                      <MapPinned className="mr-2 h-4 w-4" />
                      Acompanhar pedido
                    </a>
                  )}
                  <SheetClose asChild>
                    <Button
                      variant="ghost"
                      className="mt-3 rounded-xl text-[#647064]"
                    >
                      Voltar à loja
                    </Button>
                  </SheetClose>
                </main>
              ) : s.pendingPayment ? (
                <PendingPaymentPanel
                  payment={s.pendingPayment}
                  accent={accent}
                  changing={s.changingPaymentMethod}
                  trackingHref={trackingHref}
                  onChangeMethod={s.changePaymentMethod}
                  onExpandQr={() => setPixQrExpanded(true)}
                />
              ) : s.cartDetails.length === 0 ? (
                <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-5 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-[#718477] shadow-sm">
                    <ShoppingBag className="h-7 w-7" />
                  </div>
                  <h1 className="mt-5 font-display text-2xl font-bold">
                    Seu pedido está vazio
                  </h1>
                  <p className="mt-2 text-sm text-[#737a73]">
                    Volte ao cardápio e escolha algo gostoso para começar.
                  </p>
                  <SheetClose asChild>
                    <Button
                      className="mt-6 rounded-2xl px-6 text-white"
                      style={{ backgroundColor: accent }}
                    >
                      Voltar ao cardápio
                    </Button>
                  </SheetClose>
                </main>
              ) : (
                <main className="mx-auto w-full max-w-6xl px-3 pb-28 pt-3 sm:px-5 lg:flex lg:min-h-full lg:items-center lg:pb-4 lg:pt-4">
                  <div className="grid w-full grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:gap-4">
                    <section
                      id="checkout-contact"
                      className="rounded-3xl border border-[#e7e9e4] bg-white p-4 shadow-[0_8px_28px_rgba(30,45,33,0.04)] sm:p-5"
                    >
                      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold tracking-tight">
                        <UserRound className="h-4 w-4 text-[#2f5d50]" /> Seus
                        dados
                      </h2>
                      <div className="grid grid-cols-2 gap-2.5">
                        <Field label="Nome">
                          <Input
                            value={s.customer.name}
                            onChange={e =>
                              setCustomerField("name", e.target.value)
                            }
                            placeholder="Seu nome"
                            autoComplete="name"
                            className={fieldClass}
                          />
                        </Field>
                        <Field label="WhatsApp">
                          <Input
                            value={s.customer.phone}
                            onChange={e =>
                              setCustomerField(
                                "phone",
                                formatPhone(e.target.value)
                              )
                            }
                            placeholder="(11) 99999-9999"
                            autoComplete="tel"
                            inputMode="tel"
                            className={fieldClass}
                          />
                        </Field>
                      </div>
                      <div className="mt-2.5 space-y-2.5">
                        {emailVerified ? (
                          <div className="rounded-xl bg-[#eff5ef] p-3">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-[#347052]">
                              <Check className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {s.customer.email}
                              </span>
                            </p>
                            <p className="mt-0.5 text-xs text-[#526d58]">
                              E-mail confirmado. Seus dados ficam salvos para a
                              próxima compra.
                            </p>
                            <button
                              type="button"
                              onClick={useAnotherEmail}
                              className="mt-1 text-xs font-semibold text-[#526d58] underline"
                            >
                              Usar outro e-mail
                            </button>
                          </div>
                        ) : codeSent ? (
                          <div className="rounded-xl bg-[#f8faf7] p-3">
                            <p className="text-sm text-[#414941]">
                              Enviamos um código para{" "}
                              <strong className="break-all">{typedEmail}</strong>
                              . Confira também o spam.
                            </p>
                            <div className="mt-2 flex gap-2">
                              <Input
                                value={emailCode}
                                onChange={e =>
                                  setEmailCode(
                                    e.target.value.replace(/\D/g, "").slice(0, 8)
                                  )
                                }
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                placeholder="Código do e-mail"
                                aria-label="Código enviado por e-mail"
                                className={fieldClass}
                              />
                              <Button
                                type="button"
                                onClick={verifyEmail}
                                disabled={authBusy || emailCode.length < 6}
                                className="h-11 shrink-0 rounded-xl px-4 text-white"
                                style={{ backgroundColor: accent }}
                              >
                                {authBusy ? "…" : "Validar"}
                              </Button>
                            </div>
                            <div className="mt-1 flex gap-4">
                              <button
                                type="button"
                                onClick={sendEmailCode}
                                disabled={authBusy}
                                className="py-1.5 text-xs font-semibold text-[#526d58] underline"
                              >
                                Reenviar código
                              </button>
                              <button
                                type="button"
                                onClick={correctEmail}
                                className="py-1.5 text-xs font-semibold text-[#526d58] underline"
                              >
                                Corrigir e-mail
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Field label="E-mail">
                              <Input
                                type="email"
                                value={s.customer.email}
                                onChange={e => {
                                  setAuthError("");
                                  setCustomerField("email", e.target.value);
                                }}
                                placeholder="voce@exemplo.com"
                                autoComplete="email"
                                className={fieldClass}
                              />
                            </Field>
                            <Field label="Confirme o e-mail">
                              <Input
                                type="email"
                                value={emailConfirmation}
                                onChange={e => {
                                  setAuthError("");
                                  setEmailConfirmation(e.target.value);
                                }}
                                onPaste={e => e.preventDefault()}
                                placeholder="Digite de novo"
                                autoComplete="off"
                                aria-invalid={
                                  Boolean(emailConfirmation) && !emailsMatch
                                }
                                className={fieldClass}
                              />
                            </Field>
                            {emailConfirmation && !emailsMatch && (
                              <p role="alert" className="text-xs text-red-600">
                                Os dois e-mails precisam ser iguais.
                              </p>
                            )}
                            <Button
                              type="button"
                              onClick={sendEmailCode}
                              disabled={authBusy || !emailValid || !emailsMatch}
                              className="h-11 w-full rounded-xl text-white"
                              style={{ backgroundColor: accent }}
                            >
                              <MailCheck className="mr-2 h-4 w-4" />
                              {authBusy ? "Enviando…" : "Enviar código"}
                            </Button>
                            <p className="text-xs text-[#788078]">
                              Confirmando o e-mail, seus dados ficam salvos para
                              a próxima compra.
                            </p>
                          </>
                        )}
                        {authError && (
                          <p role="alert" className="text-xs text-red-600">
                            {authError}
                          </p>
                        )}
                      </div>

                      <div
                        id="checkout-address"
                        className="mt-4 border-t border-[#edf0eb] pt-4"
                      >
                        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold tracking-tight">
                          <MapPin className="h-4 w-4 text-[#2f5d50]" />
                          {s.pickupAvailable ? "Como receber" : "Endereço"}
                        </h2>
                        {s.pickupAvailable && (
                          <div className="mb-3 grid grid-cols-2 gap-2">
                            {(
                              [
                                ["delivery", "Entrega", Bike],
                                ["pickup", "Retirar na loja", Store],
                              ] as const
                            ).map(([value, label, Icon]) => (
                              <button
                                key={value}
                                type="button"
                                aria-pressed={s.fulfillment === value}
                                onClick={() => s.setFulfillment(value)}
                                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold ${s.fulfillment === value ? "border-[#6d8c72] bg-[#eff5ef] text-[#315c3c]" : "border-[#e7e9e4] bg-white text-[#657066]"}`}
                              >
                                <Icon className="h-4 w-4" /> {label}
                              </button>
                            ))}
                          </div>
                        )}
                        {pickup ? (
                          <p className="rounded-xl bg-[#f8faf7] p-3 text-sm text-[#414941]">
                            Retire em: {s.company?.pickupAddress}
                          </p>
                        ) : (
                          <>
                            {savedAddresses.length > 0 && (
                              <div className="-mx-1 mb-2.5 flex gap-2 overflow-x-auto px-1 pb-1">
                                {savedAddresses.map(entry => (
                                  <button
                                    key={entry.id}
                                    type="button"
                                    onClick={() => chooseAddress(entry)}
                                    className={`h-11 shrink-0 rounded-xl border px-3 text-left text-xs ${selectedAddressId === entry.id ? "border-[#6d8c72] bg-[#eff5ef] text-[#315c3c]" : "border-[#e7e9e4] bg-white text-[#657066]"}`}
                                  >
                                    <span className="block max-w-[180px] truncate font-semibold">
                                      {entry.address}, {entry.addressNumber}
                                    </span>
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedAddressId(null);
                                    s.setCustomer(current => ({
                                      ...current,
                                      address: "",
                                      addressNumber: "",
                                      addressComplement: "",
                                      addressReference: "",
                                    }));
                                  }}
                                  className="h-11 shrink-0 rounded-xl border border-dashed border-[#cdd6cd] px-3 text-xs font-semibold text-[#526d58]"
                                >
                                  + Novo
                                </button>
                              </div>
                            )}
                            <AddressAutocomplete
                              value={s.customer.address}
                              onChange={value =>
                                setCustomerField("address", value)
                              }
                              onNumberChange={value =>
                                setCustomerField("addressNumber", value)
                              }
                              showNumberInput={false}
                              placeholder="CEP ou rua e bairro"
                            />
                            <div className="mt-2.5 grid grid-cols-[84px_minmax(0,1fr)] gap-2.5 sm:grid-cols-[84px_minmax(0,1fr)_minmax(0,1fr)]">
                              <Field label="Nº">
                                <Input
                                  value={s.customer.addressNumber}
                                  onChange={e =>
                                    setCustomerField(
                                      "addressNumber",
                                      e.target.value
                                    )
                                  }
                                  placeholder="120"
                                  inputMode="numeric"
                                  className={fieldClass}
                                />
                              </Field>
                              <Field label="Complemento" optional>
                                <Input
                                  value={s.customer.addressComplement}
                                  onChange={e =>
                                    setCustomerField(
                                      "addressComplement",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Apto, bloco"
                                  className={fieldClass}
                                />
                              </Field>
                              <div className="col-span-2 sm:col-span-1">
                                <Field label="Referência" optional>
                                  <Input
                                    value={s.customer.addressReference}
                                    onChange={e =>
                                      setCustomerField(
                                        "addressReference",
                                        e.target.value
                                      )
                                    }
                                    placeholder="Portão azul…"
                                    className={fieldClass}
                                  />
                                </Field>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </section>

                    <aside className="rounded-3xl border border-[#e4e8e1] bg-white p-4 shadow-[0_14px_42px_rgba(30,45,33,0.07)] sm:p-5">
                      <h2 className="mb-2 flex items-center justify-between font-display text-lg font-bold tracking-tight">
                        <span className="flex items-center gap-2">
                          <ShoppingBag className="h-4 w-4 text-[#2f5d50]" />{" "}
                          Pedido
                        </span>
                        <span className="text-xs font-medium text-[#808880]">
                          {s.totalItems} {s.totalItems === 1 ? "item" : "itens"}
                        </span>
                      </h2>
                      <div className="max-h-[40dvh] space-y-3 overflow-y-auto">
                        {s.cartDetails.map(({ item, qty, observation }) => (
                          <div key={item.id}>
                            <div className="flex items-center gap-2.5">
                              <img
                                src={item.image}
                                alt=""
                                className="h-11 w-11 shrink-0 rounded-xl object-cover"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-[#333c34]">
                                  {item.name}
                                </p>
                                <p className="text-sm text-[#3d4d40]">
                                  {money(item.price * qty)}
                                </p>
                              </div>
                              <div className="flex items-center">
                                <button
                                  aria-label={`Diminuir ${item.name}`}
                                  onClick={() => s.changeQty(item.id, -1)}
                                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e4e8e1] text-[#657166]"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="w-6 text-center text-sm">
                                  {qty}
                                </span>
                                <button
                                  aria-label={`Aumentar ${item.name}`}
                                  onClick={() => s.add(item.id)}
                                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e4e8e1] text-[#657166]"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            {openNotes.includes(item.id) || observation ? (
                              <Input
                                value={observation}
                                onChange={e =>
                                  s.updateObservation(item.id, e.target.value)
                                }
                                maxLength={300}
                                placeholder="Ex.: sem cebola"
                                aria-label={`Observação de ${item.name}`}
                                className={`${fieldClass} mt-1.5`}
                              />
                            ) : (
                              <button
                                type="button"
                                onClick={() => toggleNote(item.id)}
                                className="mt-0.5 py-1.5 text-xs font-semibold text-[#526d58] underline"
                              >
                                Adicionar observação
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 space-y-0.5 border-t border-dashed border-[#e1e6df] pt-2.5 text-sm text-[#788078]">
                        {(s.delivery > 0 ||
                          s.deliveryQuoteLoading ||
                          s.deliveryQuoteError) && (
                          <>
                            <div className="flex justify-between">
                              <span>Subtotal</span>
                              <span>{money(s.subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Entrega</span>
                              {s.deliveryQuoteLoading ? (
                                <span className="text-xs">Calculando…</span>
                              ) : s.deliveryQuoteError ? (
                                <span className="max-w-[65%] text-right text-xs text-red-600">
                                  {s.deliveryQuoteError}
                                </span>
                              ) : (
                                <span>{money(s.delivery)}</span>
                              )}
                            </div>
                          </>
                        )}
                        <div className="flex items-baseline justify-between pt-1">
                          <span className="font-semibold text-[#414941]">
                            Total
                          </span>
                          <span className="font-display text-2xl font-bold tracking-tight text-[#2f5d50]">
                            {money(s.total)}
                          </span>
                        </div>
                      </div>

                      <div
                        id="checkout-payment"
                        className="mt-3 border-t border-[#edf0eb] pt-3"
                      >
                        {!s.storeStatus.open ? (
                          <p className="rounded-xl bg-[#fff6e8] p-3 text-sm text-[#9b6a2d]">
                            {s.storeStatus.label}. Seu carrinho fica guardado
                            até lá.
                          </p>
                        ) : !emailVerified ? (
                          <p className="rounded-xl bg-[#f8faf7] p-3 text-sm text-[#737d73]">
                            Confirme seu e-mail para liberar o pagamento.
                          </p>
                        ) : !contactComplete ? (
                          <p className="rounded-xl bg-[#f8faf7] p-3 text-sm text-[#737d73]">
                            Preencha nome e WhatsApp para continuar.
                          </p>
                        ) : !addressComplete ? (
                          <p className="rounded-xl bg-[#f8faf7] p-3 text-sm text-[#737d73]">
                            Informe o endereço e o número para continuar.
                          </p>
                        ) : !quoteReady ? (
                          <p className="rounded-xl bg-[#f8faf7] p-3 text-sm text-[#737d73]">
                            {s.deliveryQuoteLoading
                              ? "Calculando a taxa da entrega…"
                              : s.deliveryQuoteError ||
                                "Aguardando cotação para este endereço."}
                          </p>
                        ) : !canPayOnline && !s.cashAvailable ? (
                          <p className="rounded-xl bg-[#f8faf7] p-3 text-sm text-[#737d73]">
                            Pagamento indisponível: a loja ainda não conectou o
                            Mercado Pago.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {s.paymentError && (
                              <p
                                role="alert"
                                className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                              >
                                {s.paymentError}
                              </p>
                            )}
                            {canPayOnline && (
                              <Button
                                type="button"
                                onClick={payWithPix}
                                disabled={payBusy}
                                className="h-12 w-full rounded-xl text-base font-semibold text-white shadow-md"
                                style={{ backgroundColor: accent }}
                              >
                                {payBusy ? (
                                  "Aguarde…"
                                ) : (
                                  <>
                                    <QrCode className="mr-2 h-5 w-5" /> Pagar
                                    com Pix · {money(s.total)}
                                  </>
                                )}
                              </Button>
                            )}
                            {canPayOnline &&
                              s.checkoutConfigQuery.data?.publicKey && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => setShowCard(v => !v)}
                                    aria-expanded={showCard}
                                    className="flex h-11 w-full items-center justify-between rounded-xl border border-[#e4e8e1] px-3 text-sm font-semibold text-[#49624f]"
                                  >
                                    <span className="flex items-center gap-2">
                                      <CreditCard className="h-4 w-4" /> Cartão
                                      de crédito ou débito
                                    </span>
                                    <ChevronRight
                                      className={`h-4 w-4 transition ${showCard ? "rotate-90" : ""}`}
                                    />
                                  </button>
                                  {showCard && (
                                    <MercadoPagoBrick
                                      key={s.cardAttempt}
                                      publicKey={
                                        s.checkoutConfigQuery.data.publicKey
                                      }
                                      amount={s.total}
                                      payerEmail={s.customer.email.trim()}
                                      onSubmit={submitPayment}
                                      onError={message => toast.error(message)}
                                    />
                                  )}
                                </>
                              )}
                            {s.cashAvailable && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setShowCash(v => !v)}
                                  aria-expanded={showCash}
                                  className="flex h-11 w-full items-center justify-between rounded-xl border border-[#e4e8e1] px-3 text-sm font-semibold text-[#49624f]"
                                >
                                  <span className="flex items-center gap-2">
                                    <Banknote className="h-4 w-4" /> Pagar{" "}
                                    {payOnArrival}
                                  </span>
                                  <ChevronRight
                                    className={`h-4 w-4 transition ${showCash ? "rotate-90" : ""}`}
                                  />
                                </button>
                                {showCash && (
                                  <div className="space-y-2 rounded-xl bg-[#f8faf7] p-3">
                                    <p className="text-xs text-[#737d73]">
                                      Dinheiro ou maquininha {payOnArrival}.
                                    </p>
                                    <Field label="Precisa de troco?" optional>
                                      <Input
                                        value={changeFor}
                                        onChange={e =>
                                          setChangeFor(e.target.value)
                                        }
                                        maxLength={20}
                                        placeholder="Troco para R$ 50"
                                        className={fieldClass}
                                      />
                                    </Field>
                                    <Button
                                      type="button"
                                      onClick={confirmCashOrder}
                                      disabled={payBusy}
                                      className="h-12 w-full rounded-xl font-semibold text-white"
                                      style={{ backgroundColor: accent }}
                                    >
                                      {payBusy
                                        ? "Aguarde…"
                                        : `Finalizar pedido · ${money(s.total)}`}
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                            {canPayOnline && (
                              <p className="flex items-center justify-center gap-1.5 text-[11px] text-[#899188]">
                                <LockKeyhole className="h-3 w-3" /> Pagamento
                                seguro · Mercado Pago
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </aside>
                  </div>
                </main>
              )}
            </div>
            {!s.orderComplete &&
              !s.pendingPayment &&
              s.cartDetails.length > 0 && (
                <div className="fixed bottom-0 left-0 z-[60] w-screen border-t border-[#e4e8e1] bg-white/95 px-4 py-3 shadow-[0_-8px_28px_rgba(25,40,28,0.10)] backdrop-blur-xl lg:hidden">
                  <div className="mx-auto flex max-w-xl items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-[#778078]">
                        Total do pedido
                      </p>
                      <p className="font-display text-xl font-bold text-[#2f5d50]">
                        {money(s.total)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={fixedAction.run}
                      disabled={payBusy}
                      className="h-12 shrink-0 rounded-2xl px-5 text-white"
                      style={{ backgroundColor: accent }}
                    >
                      {payBusy ? "Aguarde…" : fixedAction.label}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            {pixQrExpanded && pendingQr && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label="QR code Pix ampliado"
                onClick={() => setPixQrExpanded(false)}
                className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
              >
                <div
                  onClick={event => event.stopPropagation()}
                  className="w-full max-w-md rounded-[28px] bg-white p-5 text-center shadow-2xl sm:p-7"
                >
                  <div className="mb-4 flex items-center justify-between gap-3 text-left">
                    <div>
                      <h2 className="font-display text-xl font-bold text-[#252a26]">
                        Leia o QR Pix
                      </h2>
                      <p className="mt-1 text-sm text-[#737a73]">
                        Abra o app do banco e aponte a câmera para a tela.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Fechar QR ampliado"
                      onClick={() => setPixQrExpanded(false)}
                      className="shrink-0 rounded-full"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  <img
                    src={`data:image/png;base64,${pendingQr}`}
                    alt="QR code Pix ampliado para leitura"
                    className="mx-auto h-auto w-full max-w-[320px] rounded-2xl border border-[#e8ebe5] bg-white p-2"
                  />
                  {pendingPix && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={copyPixCode}
                      className="mt-4 w-full rounded-xl border-[#dce3da]"
                    >
                      <Copy className="mr-2 h-4 w-4" /> Copiar código Pix
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Aviso de loja fechada e atalho do carrinho, iguais em todos os modelos. O Bistrô já tem barra própria. */
function StoreBottomBar(s: Storefront & { accent: string }) {
  const hasOwnCartBar = s.company?.templateId === "premium";
  const showCart = s.totalItems > 0 && !hasOwnCartBar;
  const showClosed = !s.storeStatus.open;
  if (!showCart && !showClosed) return null;
  return (
    <>
      {showCart && <div className="h-20 xl:hidden" />}
      <div
        className={`pointer-events-none fixed left-0 z-30 w-screen space-y-2 px-4 ${hasOwnCartBar ? (s.totalItems > 0 ? "bottom-[132px] lg:bottom-4" : "bottom-[72px] lg:bottom-4") : "bottom-3"}`}
      >
        {showClosed && (
          <p
            role="status"
            className="mx-auto max-w-xl rounded-2xl bg-[#3a2f24] px-4 py-3 text-center text-sm font-semibold text-white shadow-xl"
          >
            {s.storeStatus.label}
          </p>
        )}
        {showCart && (
          <button
            type="button"
            onClick={() => s.setCartOpen(true)}
            className="pointer-events-auto mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl px-5 py-3.5 text-white shadow-xl xl:hidden"
            style={{ backgroundColor: s.accent }}
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <ShoppingBag className="h-4 w-4" /> {s.totalItems}{" "}
              {s.totalItems === 1 ? "item" : "itens"}
            </span>
            <span className="text-sm font-bold">
              {money(s.total)} · Ver pedido
            </span>
          </button>
        )}
      </div>
    </>
  );
}
