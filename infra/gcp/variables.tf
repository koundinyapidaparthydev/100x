variable "project_id" {
  description = "GCP project ID for this AplifyAI environment."
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id must be a valid GCP project ID."
  }
}

variable "region" {
  description = "Primary region for Cloud Run, Artifact Registry, and regional resources."
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment. The stage resource suffix remains 'staging' for compatibility with the existing stack."
  type        = string
  default     = "stage"

  validation {
    condition     = contains(["dev", "stage", "production"], var.environment)
    error_message = "environment must be one of: dev, stage, production."
  }
}

variable "name_prefix" {
  description = "Short prefix for resource names."
  type        = string
  default     = "aplifyai"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}$", var.name_prefix))
    error_message = "name_prefix must be a short lowercase slug."
  }
}

variable "vpc_subnet_cidr" {
  description = "IPv4 CIDR for this environment's regional subnet. Use a distinct range per environment."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.vpc_subnet_cidr))
    error_message = "vpc_subnet_cidr must be a valid IPv4 CIDR, for example 10.10.0.0/24."
  }
}

variable "enable_apis" {
  description = "When true, enable required Google APIs in the project."
  type        = bool
  default     = true
}

variable "artifact_repo_id" {
  description = "Artifact Registry repository ID for container images."
  type        = string
  default     = "aplifyai"
}

variable "cloud_run_image" {
  description = "Full container image URI for the API (Artifact Registry). Leave empty to skip creating the Cloud Run service until an image is pushed."
  type        = string
  default     = ""
}

variable "cloud_run_min_instances" {
  description = "Minimum Cloud Run instances (0 saves cost in non-production)."
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum Cloud Run instances. Keep at 1 while using JSONB snapshot persistence."
  type        = number
  default     = 1

  validation {
    condition     = var.cloud_run_max_instances == 1
    error_message = "cloud_run_max_instances must remain 1 until persistence is migrated from the single-writer JSONB snapshot."
  }
}

variable "cloud_run_cpu" {
  description = "Cloud Run CPU limit."
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Cloud Run memory limit."
  type        = string
  default     = "512Mi"
}

variable "cloud_run_allow_unauthenticated" {
  description = "If true, allow public invoke on Cloud Run (typical for a public API behind HTTPS). Prefer Identity-Aware Proxy / LB auth for production."
  type        = bool
  default     = false
}

variable "auth_allow_demo_login" {
  description = "Enable seeded demo login. Use only in dev; stage and production examples keep this false."
  type        = bool
  default     = false
}

variable "web_app_origin" {
  description = "Public web app origin used for post-login redirects (no trailing slash)."
  type        = string
  default     = "http://localhost:3000"
}

variable "google_redirect_uri" {
  description = "OAuth redirect URI for Continue with Google (must match Google Cloud Console)."
  type        = string
  default     = "http://localhost:4000/api/v1/auth/google/callback"
}

variable "google_default_role" {
  description = "Default UserRole for Google social login when no invite applies. Workspace creators use root."
  type        = string
  default     = "root"
}

variable "jira_base_url" {
  description = "Optional Jira Cloud base URL. The API token remains in Secret Manager."
  type        = string
  default     = ""
}

variable "jira_email" {
  description = "Optional Jira Cloud account email used with the API token."
  type        = string
  default     = ""
}

variable "sql_tier" {
  description = "Cloud SQL machine tier."
  type        = string
  default     = "db-f1-micro"
}

variable "sql_disk_size_gb" {
  description = "Cloud SQL disk size in GB."
  type        = number
  default     = 20
}

variable "sql_availability_type" {
  description = "Cloud SQL availability mode. Production should use REGIONAL."
  type        = string
  default     = "ZONAL"

  validation {
    condition     = contains(["ZONAL", "REGIONAL"], var.sql_availability_type)
    error_message = "sql_availability_type must be ZONAL or REGIONAL."
  }
}

variable "sql_deletion_protection" {
  description = "Protect the Cloud SQL instance from accidental destroy."
  type        = bool
  default     = true
}

variable "sql_backup_enabled" {
  description = "Enable automated Cloud SQL backups."
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Application database name."
  type        = string
  default     = "aplifyai"
}

variable "db_user" {
  description = "Application database user."
  type        = string
  default     = "aplifyai"
}

variable "artifact_retention_days" {
  description = "Soft-delete retention for generated AI artifacts in GCS (days)."
  type        = number
  default     = 30
}

variable "alert_email" {
  description = "Optional email for monitoring notification channel. Empty skips channel creation."
  type        = string
  default     = ""
}

variable "enable_static_cdn" {
  description = "Create a public HTTPS load balancer and Cloud CDN for the static assets bucket. Requires at least one static_domain."
  type        = bool
  default     = false
}

variable "static_domains" {
  description = "Custom DNS names for the AplifyAI frontend (documented domain: aplifyai.com). Google-managed certificates are created only when enable_static_cdn is true and this list is non-empty."
  type        = list(string)
  default     = []

  validation {
    condition = alltrue([
      for domain in var.static_domains :
      can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", domain))
    ])
    error_message = "static_domains must contain lowercase DNS names without schemes, paths, ports, or wildcards."
  }
}

variable "static_dns_managed_zone" {
  description = "Optional existing Cloud DNS managed-zone name. When set, A records for static_domains point to the load balancer; when empty, manage DNS externally."
  type        = string
  default     = ""
}

variable "static_dns_ttl" {
  description = "TTL in seconds for optional Cloud DNS A records."
  type        = number
  default     = 300

  validation {
    condition     = var.static_dns_ttl >= 30
    error_message = "static_dns_ttl must be at least 30 seconds."
  }
}

variable "labels" {
  description = "Extra labels merged onto all labeled resources."
  type        = map(string)
  default     = {}
}
