export type PlanId = 'gratuito' | 'premium' | 'diamante' | 'master';

export interface Plan {
  id: PlanId;
  name: string;
  priceYearly: number;
  priceMonthly: number;
  whatsappNumbers: number;
  postLimitPerDay: number | null;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'gratuito',
    name: 'Gratuito',
    priceYearly: 0,
    priceMonthly: 0,
    whatsappNumbers: 0,
    postLimitPerDay: 10,
    features: ['Gerar Postagem: até 10/dia', 'Links curtos /r/ com rastreio', 'Sem automação WhatsApp'],
  },
  {
    id: 'premium',
    name: 'Premium',
    priceYearly: 159.9,
    priceMonthly: 14.9,
    whatsappNumbers: 1,
    postLimitPerDay: null,
    features: [
      'Posts ilimitados',
      '1 número WhatsApp',
      'Copiador + Distribuidor',
      'Agendamento, Fila e envio automático',
      'Sorteio + Boas-vindas',
      'Relatórios de cliques',
    ],
  },
  {
    id: 'diamante',
    name: 'Diamante',
    priceYearly: 299.9,
    priceMonthly: 29.9,
    whatsappNumbers: 1,
    postLimitPerDay: null,
    features: [
      'Tudo do Premium',
      'Shopee, Amazon, ML, Magalu e Shein',
      'Links com rastreio por número',
    ],
  },
  {
    id: 'master',
    name: 'Master',
    priceYearly: 697.0,
    priceMonthly: 69.9,
    whatsappNumbers: 2,
    postLimitPerDay: null,
    features: [
      'Tudo do Diamante',
      '2 números WhatsApp',
      'Regras ilimitadas por número',
    ],
  },
];
