import axios from "axios";

type StkPushResult = {
  CheckoutRequestID: string;
  MerchantRequestID: string;
};

export const initiateGatewayStkPush = async ({
  phone,
  amount,
  orderRef,
  description,
}: {
  phone: string;
  amount: number;
  orderRef: string;
  description?: string;
}): Promise<StkPushResult> => {
  // Gateway derives app_code from the API key and builds
  // AccountReference = {app_code}-{order_ref} itself — never send it here.
  const { data } = await axios.post(
    `${process.env.GATEWAY_BASE_URL}/gateway/stkpush`,
    {
      phone,
      amount,
      order_ref: orderRef,
      description: description ?? "Wishlist item payment",
    },
    { headers: { "X-API-Key": process.env.GATEWAY_API_KEY! } }
  );

  return data;
};
