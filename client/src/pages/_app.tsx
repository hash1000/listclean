import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import Modal from 'react-modal';

// Set the app element to hide it from screen readers when the modal is open
if (typeof window !== 'undefined') {
  Modal.setAppElement('#__next');
}
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
