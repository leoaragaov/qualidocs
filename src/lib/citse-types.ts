export type CronogramaRow = {
  fase: string;
  atividade: string;
  inicio: string;
  fim: string;
  responsavel: string;
  status: string;
};

export type RiscoRow = {
  id: string;
  descricao: string;
  probabilidade: string;
  impacto: string;
  mitigacao: string;
  responsavel: string;
};

export type Plano = {
  projeto: string;
  versao: string;
  responsavel: string;
  dataCriacao: string;
  ultimaRevisao: string;
  ambiente: string;
  objetivo: string;
  inScope: string;
  outOfScope: string;
  cronograma: CronogramaRow[];
  riscos: RiscoRow[];
};

export type UserStory = {
  id: string;
  modulo: string;
  ator: string;
  story: string;
  criterio1: string;
  criterio2: string;
  regra_negocio?: string;
  prioridade: string;
  sprint: string;
  status: string;
};

export type CasoTeste = {
  id: string;
  idUs: string;
  modulo: string;
  tipo: string;
  precondicoes: string;
  massa: string;
  passos: string;
  esperado: string;
  obtido: string;
  status: string;
  evidencia: string;
  observacoes: string;
};

export type CitseData = {
  plano: Plano;
  userStories: UserStory[];
  casosTeste: CasoTeste[];
};

export const defaultData: CitseData = {
  plano: {
    projeto: "",
    versao: "",
    responsavel: "",
    dataCriacao: "",
    ultimaRevisao: "",
    ambiente: "",
    objetivo: "",
    inScope: "",
    outOfScope: "",
    cronograma: [],
    riscos: [],
  },
  userStories: [],
  casosTeste: [],
};
