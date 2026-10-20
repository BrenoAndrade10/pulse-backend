export type TrackingRuleTrigger = 'click' | 'submit';
/** `page`: só a página onde foi criada; `site`: todas as páginas do pixel. */
export type TrackingRuleScope = 'page' | 'site';

/** Como reencontrar o elemento na página (ver tracker/src/fingerprint.ts). */
export type TrackingRuleElement = {
  selector: string;
  tag: string;
  text?: string;
  attributes: Record<string, string>;
};

/** O que um campo do formulário é, para guardar no lead. */
export type TrackingFieldKey =
  'name' | 'email' | 'phone' | 'consent' | 'custom';

/** Campo do formulário mapeado: o pixel lê só estes, nunca o resto. */
export type TrackingRuleField = {
  key: TrackingFieldKey;
  /** Identificador do campo no envio (ex.: "email", "como_conheceu"). */
  slug: string;
  /** Rótulo mostrado no painel e no CSV (campos personalizados). */
  label: string;
  /** Seletor do campo dentro do formulário. */
  selector: string;
};

export type TrackingRuleProps = {
  id: string;
  tenantId: string;
  expertId: string;
  pixelId: string;
  /** Origem + caminho da página onde a regra foi criada. */
  pageUrl: string;
  scope: TrackingRuleScope;
  trigger: TrackingRuleTrigger;
  eventName: string;
  element: TrackingRuleElement;
  /** Só em regras de envio de formulário. */
  fields: TrackingRuleField[];
  createdAt: Date;
  updatedAt: Date;
};

/** Regra de evento: quando o elemento for clicado (ou o formulário enviado), conta o evento. */
export class TrackingRule {
  constructor(private readonly props: TrackingRuleProps) {}

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get expertId(): string {
    return this.props.expertId;
  }

  get pixelId(): string {
    return this.props.pixelId;
  }

  get pageUrl(): string {
    return this.props.pageUrl;
  }

  get scope(): TrackingRuleScope {
    return this.props.scope;
  }

  get trigger(): TrackingRuleTrigger {
    return this.props.trigger;
  }

  get eventName(): string {
    return this.props.eventName;
  }

  get element(): TrackingRuleElement {
    return this.props.element;
  }

  get fields(): TrackingRuleField[] {
    return this.props.fields;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
