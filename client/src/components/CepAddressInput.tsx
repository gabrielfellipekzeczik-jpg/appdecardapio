import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AddressAutocomplete,
  addressFromSuggestion,
} from "@/components/AddressAutocomplete";
import { trpc } from "@/lib/trpc";

const formatCep = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

/** Endereço pelo CEP primeiro; quem não sabe o CEP digita o endereço completo. */
export function CepAddressInput({
  address,
  postalCode,
  onChange,
  onNumberChange,
  inputClassName,
}: {
  address: string;
  postalCode: string;
  onChange: (address: string, postalCode: string) => void;
  onNumberChange: (value: string) => void;
  inputClassName: string;
}) {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"cep" | "full">(
    address && !postalCode ? "full" : "cep"
  );
  const [cep, setCep] = useState(postalCode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lookup = async (value: string) => {
    setLoading(true);
    setError("");
    try {
      const [found] = await utils.address.suggestions.fetch({ q: value });
      const text = found ? addressFromSuggestion(found) : null;
      if (text) onChange(text, value);
      else setError("Não encontramos esse CEP. Confira ou digite o endereço completo.");
    } catch {
      setError("A busca pelo CEP falhou. Tente de novo ou digite o endereço completo.");
    } finally {
      setLoading(false);
    }
  };

  if (mode === "full")
    return (
      <div>
        <AddressAutocomplete
          value={address}
          onChange={value => onChange(value, "")}
          onNumberChange={onNumberChange}
          showNumberInput={false}
          placeholder="Rua, bairro e cidade"
        />
        <button
          type="button"
          onClick={() => setMode("cep")}
          className="mt-1 py-1.5 text-xs font-semibold text-[#526d58] underline"
        >
          Buscar pelo CEP
        </button>
      </div>
    );

  return (
    <div>
      <label className="block min-w-0">
        <span className="mb-1 block text-xs font-semibold text-[#414941]">
          CEP
        </span>
        <div className="relative">
          <Input
            value={cep}
            onChange={event => {
              const next = formatCep(event.target.value);
              setCep(next);
              setError("");
              if (next.length === 9) void lookup(next);
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="00000-000"
            className={inputClassName}
          />
          {loading && (
            <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-[#a79b8d]" />
          )}
        </div>
      </label>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
      {address && postalCode && !error && (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#f8faf7] p-2.5 text-sm text-[#414941]">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#2f5d50]" />
          {address}
        </p>
      )}
      <button
        type="button"
        onClick={() => setMode("full")}
        className="mt-1 py-1.5 text-xs font-semibold text-[#526d58] underline"
      >
        Não sei o CEP, digitar o endereço completo
      </button>
    </div>
  );
}
