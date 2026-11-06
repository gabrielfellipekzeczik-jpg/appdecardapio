import { useEffect } from "react";

/** Define o título da aba do navegador enquanto a página está aberta e restaura o anterior ao sair. */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = title;
    return () => { document.title = previous; };
  }, [title]);
}
