import Modal from "react-modal";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "./checkoutForm";
import { useEffect, useState } from "react";
import axios from "axios";
import { loadStripe } from "@stripe/stripe-js";

// Make sure to call `loadStripe` outside of a component’s render to avoid
// recreating the `Stripe` object on every render.
const stripePromise = loadStripe(
  "pk_test_51NbOT7KnLMFZGTAgz6WvujeOeY0gZhLykXAoigj4n99ECg7y4Fqrv6s8GhSWca3pPQRxuVZuxL8ztaWCi1TN0t9j006Ypz5uZv"
);

export default function Payment(props: any) {
  const { amount, email, file, name } = props;
  const [clientSecret, setClientSecret] = useState(null);

  const customStyles = {
    content: {
      top: "50%",
      left: "50%",
      right: "auto",
      bottom: "auto",
      marginRight: "-50%",
      transform: "translate(-50%, -50%)",
      width: "400px",
      backgroundColor: "transparent",
      border: "none",
    },
  };

  const clientSecretKey = async () => {
    const { data } = await axios.post(
      "http://localhost:8080/create-payment-intent",
      {
        email: email,
        amount: amount,
      }
    );
    console.log(data);
    setClientSecret(data.clientSecret);
  };

  useEffect(() => {
    clientSecretKey();
  }, []);

  return (
    <div>
      <Modal
        style={customStyles}
        isOpen={props.showModal}
        onRequestClose={props.handleCloseModal}
      >
        {clientSecret && (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <CheckoutForm amount={amount} email={email}  file={file} name={name} />
          </Elements>
        )}
      </Modal>
    </div>
  );
}
