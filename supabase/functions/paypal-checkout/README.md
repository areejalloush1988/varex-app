# VAREX PayPal Checkout

Production-only server integration for one-time monthly, yearly, and lifetime
license payments. Prices are authoritative in `index.ts`; browser prices are
display-only.

Required Supabase Edge Function secrets:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`
- `PAYPAL_ENVIRONMENT=live`

Webhook listener:

`https://eibadfdqzpeigccfdipt.supabase.co/functions/v1/paypal-checkout/webhook`

Tracked PayPal events:

- `CHECKOUT.ORDER.APPROVED`
- `CHECKOUT.PAYMENT-APPROVAL.REVERSED`
- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.DECLINED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`

Never commit the PayPal client secret or webhook ID to the repository.
