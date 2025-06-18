# Migration for MFA fields
# Run this command in your Docker container:

# docker-compose exec backend python manage.py makemigrations accounts --name add_mfa_code_fields

# This will create a migration file to add the new fields:
# - mfa_code: CharField(max_length=6, blank=True, null=True)
# - mfa_code_expires: DateTimeField(blank=True, null=True)

# After creating the migration, apply it with:
# docker-compose exec backend python manage.py migrate

# The new fields are:
# 1. mfa_code - stores the current 6-digit code
# 2. mfa_code_expires - stores when the code expires (5 minutes from generation)

# New functionality:
# 1. Random 6-digit codes instead of TOTP
# 2. Super user PIN "123456" for admin access
# 3. Codes expire after 5 minutes
# 4. Codes are single-use (cleared after verification)
