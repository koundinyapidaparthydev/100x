terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # Backend arguments are supplied at init time so every environment can use
  # an isolated GCS state object. See backend.*.hcl.example and README.md.
  backend "gcs" {}
}
