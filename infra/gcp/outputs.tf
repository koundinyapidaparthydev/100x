output "project_id" {
  description = "GCP project used by this stack."
  value       = var.project_id
}

output "region" {
  description = "Primary region."
  value       = var.region
}

output "environment" {
  description = "Canonical deployment environment."
  value       = var.environment
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository name."
  value       = google_artifact_registry_repository.containers.name
}

output "artifact_registry_image_base" {
  description = "Base image path for docker push (append :tag)."
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.containers.repository_id}/api"
}

output "cloud_run_service_name" {
  description = "Cloud Run service name (empty until cloud_run_image is set)."
  value       = try(google_cloud_run_v2_service.api[0].name, null)
}

output "cloud_run_uri" {
  description = "HTTPS URI for the API service."
  value       = try(google_cloud_run_v2_service.api[0].uri, null)
}

output "cloud_sql_connection_name" {
  description = "Cloud SQL instance connection name for Cloud Run / Auth Proxy."
  value       = google_sql_database_instance.main.connection_name
}

output "cloud_sql_private_ip" {
  description = "Private IP of the Cloud SQL instance."
  value       = google_sql_database_instance.main.private_ip_address
  sensitive   = true
}

output "artifacts_bucket" {
  description = "GCS bucket for AI artifacts."
  value       = google_storage_bucket.artifacts.name
}

output "static_assets_bucket" {
  description = "GCS bucket for web/mobile static assets."
  value       = google_storage_bucket.static.name
}

output "static_load_balancer_ip" {
  description = "Global HTTPS load-balancer IP (null when static CDN delivery is disabled)."
  value       = try(google_compute_global_address.static[0].address, null)
}

output "static_url_map_name" {
  description = "URL map name used for Cloud CDN invalidations (null when disabled)."
  value       = try(google_compute_url_map.static[0].name, null)
}

output "static_certificate_name" {
  description = "Managed certificate name (null when static CDN delivery is disabled)."
  value       = try(google_compute_managed_ssl_certificate.static[0].name, null)
}

output "static_backend_bucket_name" {
  description = "Cloud CDN backend bucket name (null when static CDN delivery is disabled)."
  value       = try(google_compute_backend_bucket.static[0].name, null)
}

output "static_frontend_urls" {
  description = "HTTPS base URLs configured on the Google-managed certificate."
  value       = local.static_delivery_enabled ? [for domain in local.static_domains : "https://${domain}"] : []
}

output "api_service_account_email" {
  description = "Runtime service account for Cloud Run."
  value       = google_service_account.api.email
}

output "deployer_service_account_email" {
  description = "CI/CD deployer service account."
  value       = google_service_account.deployer.email
}

output "secret_ids" {
  description = "Secret Manager secret IDs (values set out-of-band)."
  value = {
    for k, s in google_secret_manager_secret.app : k => s.secret_id
  }
}

output "vpc_network" {
  description = "VPC network name."
  value       = google_compute_network.staging.name
}

output "follow_ups" {
  description = "Intentional platform deferrals."
  value = [
    "Cloud Armor / IAP in front of Cloud Run for non-public APIs.",
    "Replace the single-writer PostgreSQL JSONB snapshot with normalized repositories before horizontal scaling.",
    "Bootstrap the documented remote GCS Terraform state backend before shared team use.",
  ]
}
