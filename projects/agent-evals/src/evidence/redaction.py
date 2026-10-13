"""Known credential redaction before persistence."""

SENSITIVE_KEYS = {
    "authorization",
    "proxy-authorization",
    "cookie",
    "set-cookie",
    "password",
    "api_key",
    "apikey",
    "access_token",
    "refresh_token",
    "secret",
    "client_secret",
}


def redact(value, secrets=()):
    """Best-effort credential redaction before persistence; not a general PII filter."""
    if isinstance(value, dict):
        return {
            key: "[REDACTED]" if key.lower() in SENSITIVE_KEYS else redact(item, secrets)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact(item, secrets) for item in value]
    if isinstance(value, str):
        for secret in sorted(secrets, key=len, reverse=True):
            if secret:
                value = value.replace(secret, "[REDACTED]")
    return value
