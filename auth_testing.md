# Auth Testing Playbook

## Legacy Password Report
- Login as admin
- GET `/api/admin/customers-report/legacy-passwords`
- Verify fields: user_id, email, registered_at, password_format, risk_level, recommended_action

## Secure Password Reset
1. Trigger reset request via admin or `/api/auth/forgot-password`
2. Validate token via `GET /api/auth/reset-password/verify?token=...`
3. Submit new password via `POST /api/auth/reset-password`
4. Verify old password fails and new password succeeds
5. Confirm audit log entries and `force_password_change` handling for admin-issued reset links
