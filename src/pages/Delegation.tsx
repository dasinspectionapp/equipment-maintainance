import BackButton from '../components/BackButton';

export default function Delegation() {
  return (
    <div className="space-y-6">
      <BackButton />
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Delegation Management</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Add Delegation
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-600">Delegation content will appear here. Manage user roles and access rights.</p>
      </div>
    </div>
  );
}

