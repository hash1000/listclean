import React, { useEffect, useState } from 'react';
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import axios from 'axios';

interface PaymentFormProps {
  amount: number; 
  email: string;
  file: File;
  name: string;
}

const CARD_OPTIONS = {
  iconStyle: 'solid',
  style: {
    base: {
      iconColor: '#c4f0ff',
      color: 'black',
      fontWeight: 500,
      fontFamily: 'Roboto, Open Sans, Segoe UI, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      ':-webkit-autofill': { color: 'black' },
      '::placeholder': { color: 'black' },
    },
    invalid: {
      iconColor: '#ffc7ee',
      color: 'black',
    },
  },
};


const PaymentForm: React.FC<PaymentFormProps> = (props: PaymentFormProps) => {
  const {amount,email,file,name}=props;
  const [success, setSuccess] = useState(false);
  const stripe = useStripe();
  const elements = useElements();



  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);

    if (cardNumberElement) {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardNumberElement,
      });

      if (!error && paymentMethod) {
        try {
          const { id } = paymentMethod;
          const response = await axios.post('http://localhost:8080/payment', {
            amount: amount, // Use the amount prop
            id,
            email:email,
          });

          if (response.data.success) {
            console.log('Successful Payment');
            setSuccess(true);
            
            const formData = {
              name: name,
              file: file,
              email: email,
            };
            const response = await axios.post(
              "http://localhost:8080/formdata",
              formData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              }
            );

          }
        } catch (error) {
          console.log('Error:', error);
        }
      } else {
        console.log(error?.message);
      }
    }
  };

  return (
    <div className='payment-form'>
      {!success ? (
        <form onSubmit={handleSubmit} >
          <div className='form-group'>
            <label className='text-black'>Card Number</label>
            <CardNumberElement options={CARD_OPTIONS} />
          </div>
          <div className='form-group'>
            <label className='text-black'>Expiry Date</label>
            <CardExpiryElement options={CARD_OPTIONS} />
          </div>
          <div className='form-group'>
            <label className='text-black'>CVC</label>
            <CardCvcElement options={CARD_OPTIONS} />
          </div>
          <div className='form-group'>
          </div>
          <button className='group relative 
                py-2 px-4 border border-transparent text-sm font-medium
                rounded-md text-white bg-indigo-600
                focus:outline-none focus:ring-2 focus:ring-offset-2
                focus:ring-indigo-500'>MAKE PAYMENT</button>
        </form>
      ) : (
        <div>
          <h2 className='text-blue-800 bg-slate-50'>You Just Made Your Payment</h2>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;