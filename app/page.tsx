import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <h1 className="text-5xl font-extrabold text-green-800 mb-6">Agro-Data Hub</h1>
      <p className="text-xl text-gray-700 max-w-2xl mb-12">
        A unified agricultural information infrastructure connecting farmers, logistics carriers, and market administrators with real-time data analytics.
      </p>
      
      <div className="grid sm:grid-cols-2 gap-6 w-full max-w-4xl">
        <div className="bg-white p-8 rounded-xl shadow border border-gray-100 flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4">New User?</h2>
          <p className="text-gray-600 mb-6">Join the hub as a Farmer, Trader, Carrier, or Buyer.</p>
          <Link href="/signup" className="bg-green-700 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-800 transition w-full">
            Create an Account
          </Link>
        </div>
        
        <div className="bg-white p-8 rounded-xl shadow border border-gray-100 flex flex-col items-center">
          <h2 className="text-2xl font-bold mb-4">Existing User?</h2>
          <p className="text-gray-600 mb-6">Access your customized dashboard.</p>
          <Link href="/login" className="bg-gray-100 text-green-900 font-bold py-3 px-8 rounded-lg hover:bg-gray-200 transition w-full">
            Log In
          </Link>
        </div>
      </div>
    </main>
  );
}
