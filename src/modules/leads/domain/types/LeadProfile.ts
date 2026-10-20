/** Dados pessoais do lead. Ficam sempre cifrados no banco. */
export type LeadProfile = {
  name?: string;
  email?: string;
  phone?: string;
  /** Campos personalizados do formulário, pelo rótulo (ex.: "Como nos conheceu"). */
  custom: Record<string, string>;
};

export type EncryptedProfile = {
  encryptedValue: string;
  iv: string;
  authTag: string;
};

export type Utm = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
};
