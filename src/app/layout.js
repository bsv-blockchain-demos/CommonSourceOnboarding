import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletContextProvider } from "../context/walletContext";
import { AuthContextProvider } from "../context/authContext";
import { DidContextProvider } from "../context/DidContext";
import ToasterWrapper from "../components/toasts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "CommonSource - Digital Identity Certification",
  description: "Generate BSV-based digital identity certificates with DIDs and VCs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WalletContextProvider>
          <DidContextProvider>
            <AuthContextProvider>
              <ToasterWrapper />
              {children}
            </AuthContextProvider>
          </DidContextProvider>
        </WalletContextProvider>
      </body>
    </html>
  );
}
