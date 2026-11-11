export type IdentityConfidence = 'high' | 'medium' | 'low';

export type CanonicalEvent = {
  event_id: string;
  type: string;
  tenant_id: string;
  expert_id?: string;
  launch_id?: string;
  anonymous_id?: string;
  lead_id?: string;
  link_id?: string;
  click_id?: string;
  occurred_at: string;
  source_module: 'links' | 'tracking' | 'leads';
  attributes: Record<string, unknown>;
};
