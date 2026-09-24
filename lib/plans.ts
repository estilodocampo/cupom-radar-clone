export type PlanId = 'gratuito' | 'premium' | 'diamante' | 'master';

export interface Plan {
  id: PlanId;
  name: string;
  priceYearly: number;
  priceMonthly: number;
  whatsappNumbers: number;
  whatsappGroups: number;
  telegramGroups: number;
  postLimitPerDay: number | null;
  stores: string[];
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'gratuito',
    name: 'Gratuito',
    priceYearly: 0,
    priceMonthly: 0,
    whatsappNumbers: 0,
    whatsappGroups: 0,
    telegramGroups: 0,
    postLimitPerDay: 10,
    stores: ['shopee'],
    features: ['Gerar Postagem: até 10/dia', 'Somente Shopee', 'Sem automação'],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceYearly: 159.9,
    priceMonthly: 14.9,
    whatsappNumbers: 1,
    whatsappGroups: 12,
    telegramGroups: 12,
    postLimitPerDay: null,
    stores: ['shopee', 'amazon', 'mercadolivre', 'magalu', 'shein'],
    features: [
      'Posts ilimitados',
      '1 número WhatsApp',
      '12 grupos Whats + 12 Telegram',
      'Agendamento + envios automáticos',
      'Modo Fila/Lista Shopee (2 ativas)',
    ],
  },
  {
    id: 'diamante',
    name: 'Diamante',
    priceYearly: 299.9,
    priceMonthly: 29.9,
    whatsappNumbers: 1,
    whatsappGroups: 20,
    telegramGroups: 20,
    postLimitPerDay: null,
    stores: ['shopee', 'amazon', 'mercadolivre', 'magalu', 'shein'],
    features: [
      'Tudo do Premium',
      '20 grupos Whats + 20 Telegram',
      'Fila/Lista multi-loja',
      'Modo Copiador: 1 grupo origem',
      'Análise de Grupos: 20 grupos',
    ],
  },
  {
    id: 'master',
    name: 'Master',
    priceYearly: 697.0,
    priceMonthly: 69.9,
    whatsappNumbers: 2,
    whatsappGroups: 30,
    telegramGroups: 20,
    postLimitPerDay: null,
    stores: ['shopee', 'amazon', 'mercadolivre', 'magalu', 'shein'],
    features: [
      'Tudo do Diamante',
      '2 números WhatsApp',
      '30 grupos Whats (expansível até 50)',
      '4 filas + 4 listas ativas',
      'Modo Copiador: 3 grupos origem',
      'Randomização de disparos',
    ],
  },
];
