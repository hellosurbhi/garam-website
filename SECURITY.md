# Security Rules

Never store raw payment card data. Use Stripe Checkout or Elements only.
Never expose secret keys to the browser.
Never use Supabase service role key client-side.
All user tables require RLS with explicit policies.
All auth/payment/database changes require plan review.
All forms require validation and rate limiting.
All webhooks must verify signatures.
All production deploys require green CI.
No direct commits to main.
All API keys in environment variables, never hardcoded.
HTTPS everywhere.
