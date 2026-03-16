"""Application configuration. Use environment variables for production."""
import os

# When set, serve frontend static files (production deployment)
STATIC_DIR = os.getenv("STATIC_DIR")

# Database: SQLite for dev, PostgreSQL for production (DATABASE_URL)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./accounting.db")
# Fix SQLite URL for async if needed; sync works with sqlite:///
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# File uploads: directory for storing attachments (invoices, receipts)
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(__file__), "..", "uploads"))
MAX_ATTACHMENT_SIZE_MB = int(os.getenv("MAX_ATTACHMENT_SIZE_MB", "10"))
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}
