import RiskScorer from '@/components/RiskScorer';
import Script from 'next/script';

export default function Home() {
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

  return (
    <>
      {googleMapsKey && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`}
          strategy="afterInteractive"
        />
      )}
      <main>
        <RiskScorer />
      </main>
    </>
  );
}
