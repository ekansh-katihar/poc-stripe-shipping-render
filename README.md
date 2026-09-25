# Stripe Shipping POC — Render

Configured values:

- Product price: `price_1RtX8CJ4tvAH7yW7jAfxgcC5`
- Shipping: `$7.00`
- Shipping country: Canada
- Shipper connected account: `acct_1UJP0VJ4tv9PzUlW`

## Deploy to Render

### 1. Put this project in GitHub

Create a new GitHub repository and upload the contents of this folder.

Do **not** commit a `.env` file or Stripe secret keys.

### 2. Create the Render service

In Render:

1. Choose **New → Blueprint**.
2. Connect the GitHub repository.
3. Render will detect `render.yaml`.
4. Deploy the service.

### 3. Add the Stripe test secret key

Render will ask for:

```text
STRIPE_SECRET_KEY
```

Set it to your Stripe test secret key:

```text
sk_test_...
```

You can also add it later under:

```text
Render → Service → Environment
```

### 4. Get your Render URL

After deployment, Render gives you a URL similar to:

```text
https://stripe-shipping-poc.onrender.com
```

Open it and verify that the product page loads.

### 5. Create the Stripe webhook

In Stripe Dashboard, while in **Test mode**:

1. Go to **Developers → Webhooks**.
2. Add an endpoint:

```text
https://YOUR-RENDER-APP.onrender.com/webhook
```

3. Subscribe to:

```text
checkout.session.completed
```

4. Stripe gives you a webhook signing secret:

```text
whsec_...
```

### 6. Add webhook secret to Render

In:

```text
Render → Service → Environment
```

add:

```text
STRIPE_WEBHOOK_SECRET=whsec_...
```

Save/redeploy.

## Test

Open:

```text
https://YOUR-RENDER-APP.onrender.com
```

Click **Buy Now**.

Expected flow:

```text
Product page
→ Stripe hosted Checkout
→ Canadian shipping address
→ $7 Standard Shipping
→ product + shipping payment
→ Stripe webhook
→ $7 transfer to connected shipper account
```

Use Stripe test-mode card details.

## Important

This POC uses a **fixed $7 shipping rate**.

The next phase would replace the fixed rate with destination-based shipping pricing.
