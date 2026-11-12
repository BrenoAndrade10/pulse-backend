export const LINK_CLICKS_SINK = Symbol('LINK_CLICKS_SINK');

export type LinkClickRow = {
  click_id: string;
  link_id: string;
  tenant_id: string;
  expert_id: string;
  launch_id: string;
  code: string;
  destination_version: number;
  occurred_at: string;
  received_at: string;
  ip_hash: string;
  ua_hash: string;
  device: string;
  browser: string;
  referrer: string;
  is_bot: boolean;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
};

export interface LinkClicksSink {
  write(rows: LinkClickRow[]): Promise<void>;
}
