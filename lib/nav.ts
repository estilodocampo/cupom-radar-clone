export interface NavItem {
  href: string;
  label: string;
  icon: string;
  hint?: string;
}

export interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

export const NAV_TOP: NavItem[] = [
  { href: '/dashboard', label: 'Início', icon: '🏠', hint: 'Visão geral da operação' },
  { href: '/dashboard/saldo', label: 'Saldo', icon: '💰', hint: 'Comissões e ganhos' },
  { href: '/dashboard/robo', label: 'Robô', icon: '🤖', hint: 'Conexões e motor' },
  { href: '/dashboard/planos', label: 'Planos', icon: '💎', hint: 'Assinatura e limites' },
  { href: '/dashboard/relatorios', label: 'Relatórios', icon: '📊', hint: 'Métricas e cliques' },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Automação',
    icon: '✉️',
    items: [
      { href: '/dashboard/postagens/produtos', label: 'Criar oferta', icon: '✏️', hint: 'Nova oferta com foto e link' },
      { href: '/dashboard/postagens/copiador', label: 'Copiador', icon: '📑', hint: 'Copia ofertas entre grupos' },
      { href: '/dashboard/postagens/distribuidor', label: 'Distribuidor', icon: '🔀', hint: 'Envia para listas e canais' },
      { href: '/dashboard/postagens/envio', label: 'Envio', icon: '🚀', hint: 'Disparos e testes' },
      { href: '/dashboard/postagens/fila', label: 'Fila', icon: '📋', hint: 'Agendamentos e pendências' },
      { href: '/dashboard/postagens/sorteio', label: 'Sorteio', icon: '🎉', hint: 'Sorteios em grupos' },
    ],
  },
];

export const NAV_ACCOUNT: NavItem[] = [
  { href: '/dashboard/config/ajuda', label: 'Ajuda', icon: '❓', hint: 'Tutoriais e suporte' },
  { href: '/dashboard/config/dados', label: 'Seus Dados', icon: '👤', hint: 'Perfil, export e conta' },
  { href: '/dashboard/config/feedback', label: 'Feedback', icon: '✍️', hint: 'Enviar sugestão' },
];

/** Todas as telas, na ordem em que aparecem no menu. */
export const ALL_NAV: NavItem[] = [
  ...NAV_TOP,
  ...NAV_GROUPS.flatMap((g) => g.items),
  ...NAV_ACCOUNT,
];
