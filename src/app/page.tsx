import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50 text-gray-900">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-5xl font-extrabold text-blue-600 tracking-tight">E-Token</h1>
        <p className="text-lg text-gray-600">Digital Queue Management System</p>
        
        <div className="mt-12 flex flex-col space-y-4">
          <Link 
            href="/patient" 
            className="w-full flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-xl md:px-10 shadow-lg hover:shadow-xl transition-all"
          >
            Join as Patient
          </Link>
          <Link 
            href="/attendant" 
            className="w-full flex items-center justify-center px-8 py-4 border-2 border-blue-600 text-lg font-medium rounded-xl text-blue-600 bg-white hover:bg-blue-50 md:py-4 md:text-xl md:px-10 shadow-sm hover:shadow-md transition-all"
          >
            Clinic Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
