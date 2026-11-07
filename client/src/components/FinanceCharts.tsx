import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Paleta validada para dois grupos. Despesas também usam traço, para não depender só da cor. */
export const REVENUE_COLOR = "#15896a";
export const EXPENSE_COLOR = "#e0662f";
const INK = "#2c352d";
const MUTED = "#6f786f";
const GRID = "#eef0ec";

export const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value
  );
const compactMoney = (value: number) =>
  `R$ ${new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;

type TrendPoint = {
  label: string;
  revenue: number;
  expenses: number;
  balance: number;
};

function TrendTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: { payload: TrendPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const rows: [string, number, string, boolean][] = [
    ["Receita", point.revenue, REVENUE_COLOR, false],
    ["Despesas", point.expenses, EXPENSE_COLOR, true],
  ];
  return (
    <div className="min-w-44 rounded-xl border border-[#e7ebe5] bg-white px-3 py-2.5 text-xs shadow-lg">
      <p style={{ color: MUTED }}>{label}</p>
      {rows.map(([name, value, color, dashed]) => (
        <div key={name} className="mt-1.5 flex items-center gap-2">
          <span
            className="w-3.5 border-t-2"
            style={{
              borderColor: color,
              borderTopStyle: dashed ? "dashed" : "solid",
            }}
          />
          <span style={{ color: MUTED }}>{name}</span>
          <strong className="ml-auto" style={{ color: INK }}>
            {money(value)}
          </strong>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-[#eef0ec] pt-1.5">
        <span style={{ color: MUTED }}>Saldo</span>
        <strong style={{ color: INK }}>{money(point.balance)}</strong>
      </div>
    </div>
  );
}

function LegendKey({
  color,
  dashed,
  label,
  total,
}: {
  color: string;
  dashed?: boolean;
  label: string;
  total: number;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-xs text-[#6f786f]">
        <span
          className="w-4 border-t-2"
          style={{
            borderColor: color,
            borderTopStyle: dashed ? "dashed" : "solid",
          }}
        />
        {label}
      </p>
      <p className="mt-0.5 font-display text-xl font-bold text-[#2c352d]">
        {money(total)}
      </p>
    </div>
  );
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [showTable, setShowTable] = useState(false);
  const revenue = data.reduce((sum, point) => sum + point.revenue, 0);
  const expenses = data.reduce((sum, point) => sum + point.expenses, 0);
  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <LegendKey color={REVENUE_COLOR} label="Receita" total={revenue} />
        <LegendKey
          color={EXPENSE_COLOR}
          dashed
          label="Despesas"
          total={expenses}
        />
        <button
          type="button"
          aria-expanded={showTable}
          onClick={() => setShowTable(value => !value)}
          className="ml-auto text-xs font-semibold text-[#526d58] underline"
        >
          {showTable ? "Ver gráfico" : "Ver tabela"}
        </button>
      </div>
      {showTable ? (
        <div className="mt-3 max-h-72 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-[#6f786f]">
                <th className="py-1.5 font-medium">Período</th>
                <th className="py-1.5 text-right font-medium">Receita</th>
                <th className="py-1.5 text-right font-medium">Despesas</th>
                <th className="py-1.5 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map(point => (
                <tr key={point.label} className="border-t border-[#f1f3ef]">
                  <td className="py-1.5">{point.label}</td>
                  <td className="py-1.5 text-right">{money(point.revenue)}</td>
                  <td className="py-1.5 text-right">{money(point.expenses)}</td>
                  <td className="py-1.5 text-right">{money(point.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-3 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="trendRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={REVENUE_COLOR}
                    stopOpacity={0.22}
                  />
                  <stop
                    offset="100%"
                    stopColor={REVENUE_COLOR}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: MUTED, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={value => compactMoney(Number(value))}
                tick={{ fill: MUTED, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={62}
              />
              <Tooltip
                content={<TrendTooltip />}
                cursor={{ stroke: "#b9c2b9", strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Receita"
                stroke={REVENUE_COLOR}
                strokeWidth={2}
                fill="url(#trendRevenue)"
                dot={false}
                activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name="Despesas"
                stroke={EXPENSE_COLOR}
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
                dot={false}
                activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Ranking em barras finas: o valor fica sempre escrito, sem precisar passar o mouse. */
export function BarList({
  items,
  color,
  emptyMessage,
}: {
  items: { name: string; value: number; detail?: string }[];
  color: string;
  emptyMessage: string;
}) {
  if (!items.length)
    return (
      <p className="flex h-40 items-center justify-center px-6 text-center text-sm text-[#6f786f]">
        {emptyMessage}
      </p>
    );
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const max = sorted[0].value || 1;
  const total = sorted.reduce((sum, item) => sum + item.value, 0) || 1;
  return (
    <ul className="space-y-3.5">
      {sorted.map(item => (
        <li
          key={item.name}
          title={`${item.name}: ${money(item.value)}, ${Math.round((item.value / total) * 100)}% do total`}
        >
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-[#384139]">{item.name}</span>
            <span className="shrink-0 font-semibold text-[#2c352d]">
              {money(item.value)}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[#f1f3ef]">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${Math.max(2, (item.value / max) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
          {item.detail && (
            <p className="mt-1 text-xs text-[#6f786f]">{item.detail}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
