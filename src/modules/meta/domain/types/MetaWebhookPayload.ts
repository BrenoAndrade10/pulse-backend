export type MetaWebhookChange = {
  field: string;
  value: Record<string, unknown>;
};

export type MetaWebhookMessagingEvent = Record<string, unknown>;

export type MetaWebhookEntry = {
  id: string;
  time: number;
  changes?: MetaWebhookChange[];
  messaging?: MetaWebhookMessagingEvent[];
};

export type MetaWebhookPayload = {
  object: string;
  entry: MetaWebhookEntry[];
};
