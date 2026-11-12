CREATE TABLE IF NOT EXISTS link_clicks
(
    click_id String,
    link_id String,
    tenant_id String,
    expert_id String,
    launch_id String,
    code String,
    destination_version UInt32,
    occurred_at DateTime,
    received_at DateTime,
    ip_hash String,
    ua_hash String,
    device String,
    browser String,
    referrer String,
    is_bot Bool,
    utm_source String,
    utm_medium String,
    utm_campaign String,
    utm_content String,
    utm_term String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(occurred_at)
ORDER BY (tenant_id, link_id, occurred_at)
TTL occurred_at + INTERVAL 36 MONTH;
