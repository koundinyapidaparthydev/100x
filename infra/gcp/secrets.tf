# Secret shells only — never put secret values in Terraform variables or state
# when avoidable. After apply, set versions with gcloud (see docs/deployment).
resource "google_secret_manager_secret" "app" {
  for_each = toset(local.app_secret_ids)

  project   = var.project_id
  secret_id = "${local.name}-${each.key}"

  labels = local.default_labels

  replication {
    auto {}
  }

  depends_on = [google_project_service.required]
}

# Bootstrap DATABASE_URL from the Cloud SQL user password generated here.
# Operators should rotate this after first apply and store the new value as a
# new secret version (do not commit).
resource "google_secret_manager_secret_version" "database_url" {
  secret = google_secret_manager_secret.app["database-url"].id

  secret_data = format(
    "postgresql://%s:%s@/%s?host=/cloudsql/%s",
    var.db_user,
    urlencode(random_password.db.result),
    var.db_name,
    google_sql_database_instance.main.connection_name,
  )
}

# Placeholder versions so Cloud Run secret mounts succeed on first deploy.
# Replace immediately with real values out-of-band.
resource "google_secret_manager_secret_version" "placeholders" {
  for_each = toset([
    "session-secret",
    "openai-api-key",
    "jira-api-token",
  ])

  secret      = google_secret_manager_secret.app[each.key].id
  secret_data = "REPLACE_ME_${upper(replace(each.key, "-", "_"))}"
}
