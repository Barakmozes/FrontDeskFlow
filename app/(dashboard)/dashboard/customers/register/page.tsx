import RegisterCustomerForm from "./RegisterCustomerForm";

export default function Page() {
  return (
    <div className="px-6 bg-gray-50 min-h-screen">
      <div className="max-w-3xl mx-auto pt-6">
        <h1 className="text-xl font-bold text-gray-800">Customer Registration</h1>

        <p className="text-sm text-gray-500 mt-1">
          Create a customer (User + Profile with phone) so Reception can send pre-arrival SMS and track
          booking source/consent.
        </p>

        <div className="mt-6 bg-white border rounded-lg p-4 shadow-sm">
          <RegisterCustomerForm />
        </div>
      </div>
    </div>
  );
}
