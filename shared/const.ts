export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';

/**
 * Contas que veem os dados de EXEMPLO no painel (pedidos, estoque, financeiro, gráficos fictícios),
 * útil para demonstrar o produto. Todas as outras contas veem apenas dados reais / telas vazias.
 */
export const DEMO_DATA_VIEWER_EMAILS: readonly string[] = ["gabrielfellipekzeczik@gmail.com"];
export const isDemoDataViewer = (email?: string | null) => Boolean(email) && DEMO_DATA_VIEWER_EMAILS.includes(email!.trim().toLowerCase());
