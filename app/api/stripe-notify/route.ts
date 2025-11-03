import Stripe from "stripe";
import { handleOrderSession } from "@/services/order";
import { respOk } from "@/lib/resp";

export async function POST(req: Request) {
  try {
    const stripePrivateKey = process.env.STRIPE_PRIVATE_KEY;
    const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripePrivateKey || !stripeWebhookSecret) {
      throw new Error("invalid stripe config");
    }

    const stripe = new Stripe(stripePrivateKey);

    const sign = req.headers.get("stripe-signature") as string;
    const body = await req.text();
    if (!sign || !body) {
      // bad request: do not trigger retries
      return Response.json({ error: "invalid notify data" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        sign,
        stripeWebhookSecret
      );
    } catch (err: any) {
      // signature verification failed: 400 to avoid useless retries
      console.log("stripe verify failed: ", err);
      return Response.json(
        { error: `signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    console.log("stripe notify event: ", event);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleOrderSession(session);
        break;
      }

      default:
        console.log("not handle event: ", event.type);
    }

    return respOk();
  } catch (e: any) {
    console.log("stripe notify failed: ", e);
    return Response.json(
      { error: `handle stripe notify failed: ${e.message}` },
      { status: 500 }
    );
  }
}

// Health check for deployment self-test
export async function GET() {
  return Response.json({ ok: true });
}
