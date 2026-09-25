require("dotenv").config();
const express = require("express");
const path = require("path");
const Stripe = require("stripe");

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

const PRICE_ID = "price_1RtX8CJ4tvAH7yW7jAfxgcC5";
const SHIPPER_ACCOUNT_ID = "acct_1UJP0VJ4tv9PzUlW";
const SHIPPING_AMOUNT = 700; // $7.00

// Stripe requires the raw request body for webhook signature verification.
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event;

    try {
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(500).send("Missing STRIPE_WEBHOOK_SECRET");
      }

      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;

        if (session.payment_status === "paid") {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            session.payment_intent,
            { expand: ["latest_charge"] }
          );

          const chargeId =
            typeof paymentIntent.latest_charge === "string"
              ? paymentIntent.latest_charge
              : paymentIntent.latest_charge?.id;

          if (!chargeId) {
            throw new Error("Could not find successful charge.");
          }

          await stripe.transfers.create(
            {
              amount: SHIPPING_AMOUNT,
              currency: session.currency,
              destination: SHIPPER_ACCOUNT_ID,
              transfer_group: session.metadata.transfer_group,
              metadata: {
                checkout_session_id: session.id,
                purpose: "shipping"
              }
            },
            {
              idempotencyKey: `shipping-transfer-${session.id}`
            }
          );

          console.log(
            `Transferred ${SHIPPING_AMOUNT} ${session.currency} to ${SHIPPER_ACCOUNT_ID}`
          );
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler failed:", err);
      res.status(500).send("Webhook handler failed");
    }
  }
);

// JSON body parser must come after /webhook.
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const price = await stripe.prices.retrieve(PRICE_ID);
    const transferGroup = `ORDER_${Date.now()}`;

    // Render supplies RENDER_EXTERNAL_URL automatically.
    // APP_URL lets you override it if needed.
    const baseUrl =
      process.env.APP_URL ||
      process.env.RENDER_EXTERNAL_URL ||
      `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",

      line_items: [
        {
          price: PRICE_ID,
          quantity: 1
        }
      ],

      shipping_address_collection: {
        allowed_countries: ["CA"]
      },

      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: SHIPPING_AMOUNT,
              currency: price.currency
            },
            display_name: "Standard Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 }
            }
          }
        }
      ],

      payment_intent_data: {
        transfer_group: transferGroup
      },

      metadata: {
        transfer_group: transferGroup,
        shipping_amount: String(SHIPPING_AMOUNT),
        shipper_account: SHIPPER_ACCOUNT_ID
      },

      success_url: `${baseUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, "0.0.0.0", () => {
  console.log(`POC running on port ${port}`);
});
