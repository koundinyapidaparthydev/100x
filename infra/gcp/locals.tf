locals {
  # Keep the existing stage resource names stable. The original stack used
  # "staging", while the public environment contract now uses "stage".
  environment_name_suffix = var.environment == "stage" ? "staging" : var.environment
  name                    = "${var.name_prefix}-${local.environment_name_suffix}"

  default_labels = merge(
    {
      project     = "aplifyai"
      environment = var.environment
      managed_by  = "terraform"
    },
    var.labels,
  )

  # Secret IDs created as empty shells; values are set out-of-band (gcloud / CI).
  app_secret_ids = [
    "database-url",
    "session-secret",
    "openai-api-key",
    "jira-api-token",
  ]

  cloud_run_service_name = "${local.name}-api"
  sql_instance_name      = "${local.name}-pg"
  artifacts_bucket_name  = "${var.project_id}-${local.name}-artifacts"
  static_bucket_name     = "${var.project_id}-${local.name}-static"

  # Both an explicit opt-in and a certificate domain are required because
  # enabling CDN delivery makes objects in the static bucket publicly readable.
  static_domains          = sort(distinct(var.static_domains))
  static_delivery_enabled = var.enable_static_cdn && length(local.static_domains) > 0
}
