import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

const UF: Record<string, string> = {
  Acre: "AC",
  Alagoas: "AL",
  Amapá: "AP",
  Amazonas: "AM",
  Bahia: "BA",
  Ceará: "CE",
  "Distrito Federal": "DF",
  "Espírito Santo": "ES",
  Goiás: "GO",
  Maranhão: "MA",
  "Mato Grosso": "MT",
  "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG",
  Pará: "PA",
  Paraíba: "PB",
  Paraná: "PR",
  Pernambuco: "PE",
  Piauí: "PI",
  "Rio de Janeiro": "RJ",
  "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS",
  Rondônia: "RO",
  Roraima: "RR",
  "Santa Catarina": "SC",
  "São Paulo": "SP",
  Sergipe: "SE",
  Tocantins: "TO",
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onNumberChange?: (value: string) => void;
  onValidChange?: (valid: boolean) => void;
  showNumberInput?: boolean;
  placeholder?: string;
};
type PhotonProps = {
  name?: string;
  street?: string;
  housenumber?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  district?: string;
  suburb?: string;
  county?: string;
  state?: string;
};
type Suggestion = { id: string; street: string; number: string; rest: string };
const compose = (s: { street: string; rest: string }, number: string) =>
  `${s.street}${number ? `, ${number}` : ""}${s.rest}`;

/** Texto do endereço sem número, pronto para o checkout (ex.: resultado da busca por CEP). */
export function addressFromSuggestion(p: PhotonProps): string | null {
  const suggestion = toSuggestion(p);
  return suggestion ? compose(suggestion, "") : null;
}

function toSuggestion(p: PhotonProps): Suggestion | null {
  const street = p.street ?? p.name;
  if (!street) return null;
  const city = p.city ?? p.town ?? p.village ?? p.county;
  const uf = p.state ? (UF[p.state] ?? p.state) : undefined;
  const place = [city, uf].filter(Boolean).join(" - ");
  const district = p.district ?? p.suburb;
  const rest =
    (district ? ` - ${district}` : "") +
    [place, p.postcode]
      .filter(Boolean)
      .map(part => `, ${part}`)
      .join("");
  const suggestion = { street, number: p.housenumber ?? "", rest };
  return { ...suggestion, id: compose(suggestion, suggestion.number) };
}

/** Busca endereços brasileiros no OpenStreetMap através do proxy server-side do app (sem CORS). */
export function AddressAutocomplete({
  value,
  onChange,
  onNumberChange,
  onValidChange,
  showNumberInput = true,
  placeholder = "Rua, número, bairro, cidade - UF",
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [number, setNumber] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // CEP digitado sem traço também é reconhecido.
  const searchQuery = /^\d{8}$/.test(debouncedTerm)
    ? `${debouncedTerm.slice(0, 5)}-${debouncedTerm.slice(5)}`
    : debouncedTerm;
  const suggestionsQuery = trpc.address.suggestions.useQuery(
    { q: searchQuery },
    {
      enabled: debouncedTerm.length >= 4,
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  );
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return (suggestionsQuery.data ?? []).flatMap(properties => {
      const suggestion = toSuggestion(properties);
      if (!suggestion || seen.has(suggestion.id)) return [];
      seen.add(suggestion.id);
      return [suggestion];
    });
  }, [suggestionsQuery.data]);
  const loading = debouncedTerm.length >= 4 && suggestionsQuery.isFetching;
  const errorMessage = suggestionsQuery.error
    ? "A busca automática falhou. Você pode preencher o endereço manualmente."
    : null;
  const showResults =
    open &&
    searchTerm.trim().length >= 4 &&
    (loading ||
      suggestions.length > 0 ||
      !!errorMessage ||
      (!suggestionsQuery.isFetching && !!suggestionsQuery.data));

  const select = (suggestion: Suggestion) => {
    setOpen(false);
    setSearchTerm("");
    setSelected(suggestion);
    setNumber("");
    setConfirmed(true);
    if (showNumberInput) onChange(compose(suggestion, suggestion.number));
    else {
      onNumberChange?.(suggestion.number);
      onChange(compose(suggestion, ""));
    }
    onValidChange?.(Boolean(suggestion.number) || !showNumberInput);
  };
  const changeNumber = (raw: string) => {
    if (!selected) return;
    const next = raw.replace(/[^0-9a-zA-ZÀ-ÿ/ -]/g, "").slice(0, 12);
    setNumber(next);
    onChange(compose(selected, next.trim()));
    onValidChange?.(next.trim().length > 0);
  };
  const needsNumber = showNumberInput && Boolean(selected && !selected.number);

  return (
    <div ref={container} className="relative flex-1">
      <MapPin
        className="absolute left-3 top-3 h-4 w-4 text-[#a79b8d]"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={event => {
          const next = event.target.value;
          onChange(next);
          setSearchTerm(next);
          setConfirmed(false);
          setSelected(null);
          setNumber("");
          onValidChange?.(true);
          setOpen(next.trim().length >= 4);
        }}
        onFocus={() => {
          if (searchTerm.trim().length >= 4) setOpen(true);
        }}
        placeholder={placeholder}
        autoComplete="street-address"
        aria-label="Endereço de entrega"
        aria-expanded={showResults}
        className="h-11 rounded-xl border-[#e5e0d7] bg-[#fbfaf7] pl-9 pr-9 text-base md:text-base"
      />
      <div className="absolute right-3 top-3" aria-live="polite">
        {loading ? (
          <Loader2
            className="h-4 w-4 animate-spin text-[#a79b8d]"
            aria-label="Buscando endereços"
          />
        ) : confirmed ? (
          <Check
            className="h-4 w-4 text-[#347052]"
            aria-label="Endereço selecionado"
          />
        ) : null}
      </div>
      {showResults && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-xl border border-[#e5e0d7] bg-white shadow-xl"
        >
          {loading && (
            <li className="flex items-center gap-2 px-3 py-3 text-sm text-[#788278]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando endereços…
            </li>
          )}
          {!loading && errorMessage && (
            <li className="px-3 py-3 text-sm text-[#a05c32]">{errorMessage}</li>
          )}
          {!loading && !errorMessage && suggestions.length === 0 && (
            <li className="px-3 py-3 text-sm text-[#788278]">
              Nenhum endereço encontrado. Continue digitando ou informe
              manualmente.
            </li>
          )}
          {!loading &&
            suggestions.map(suggestion => (
              <li key={suggestion.id} role="option" aria-selected="false">
                <button
                  type="button"
                  onClick={() => select(suggestion)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm hover:bg-[#f7f2ea]"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#a05c32]" />
                  <span>{suggestion.id}</span>
                </button>
              </li>
            ))}
          <li className="px-3 py-1.5 text-right text-[10px] text-[#a79b8d]">
            OpenStreetMap · Photon
          </li>
        </ul>
      )}
      {needsNumber && (
        <div className="mt-3 flex items-center gap-3">
          <label
            htmlFor="address-number"
            className="text-xs font-semibold text-[#776e63]"
          >
            Número
          </label>
          <Input
            id="address-number"
            value={number}
            onChange={event => changeNumber(event.target.value)}
            placeholder="Ex.: 159"
            inputMode="numeric"
            className="w-28 rounded-xl border-[#e5e0d7] bg-[#fbfaf7]"
          />
          <p className="text-xs text-[#a05c32]">
            {number.trim()
              ? ""
              : "Este endereço veio sem número — informe para poder salvar."}
          </p>
        </div>
      )}
    </div>
  );
}
