export const TRACKING_EVENTS_SINK = Symbol('TRACKING_EVENTS_SINK');

/** Linha da tabela `tracking_events` do ClickHouse (ver clickhouse/001_*.sql). */
export type TrackingEventRow = {
  event_id: string;
  tenant_id: string;
  expert_id: string;
  pixel_id: string;
  rule_id: string | null;
  lead_id: string | null;
  launch_id: string | null;
  event_name: string;
  page_url: string;
  page_path: string;
  referrer: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  fbclid: string;
  click_id: string;
  fbp: string;
  fbc: string;
  anonymous_id: string;
  session_id: string;
  device: string;
  browser: string;
  ip_hash: string;
  engaged_seconds: number;
  scroll_depth: number;
  occurred_at: string;
  received_at: string;
};

export interface TrackingEventsSink {
  write(rows: TrackingEventRow[]): Promise<void>;
}
