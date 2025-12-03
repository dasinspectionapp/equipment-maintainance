import { useState, useEffect } from 'react';

interface UserProfile {
  fullName?: string;
  email?: string;
  mobile?: string;
  role?: string;
  mappedTo?: string[];
}

export default function Profile() {
  const [user, setUser] = useState<UserProfile>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user data from localStorage
    const loadUser = () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const userData = JSON.parse(storedUser);
          setUser({
            fullName: userData.fullName || userData.name || 'N/A',
            email: userData.email || 'N/A',
            mobile: userData.mobile || 'N/A',
            role: userData.role || 'N/A',
            mappedTo: userData.mappedTo || []
          });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading profile...</div>
      </div>
    );
  }

  const profileFields = [
    { label: 'Name', value: user.fullName, bgColor: '#ffffff' },
    { label: 'Email', value: user.email, bgColor: '#f0f0f0' },
    { label: 'Mobile Number', value: user.mobile, bgColor: '#ffffff' },
    { label: 'Role', value: user.role, bgColor: '#f0f0f0' },
    { label: 'Mapped Applications', value: user.mappedTo, isArray: true, bgColor: '#ffffff' }
  ];

  return (
    <div className="space-y-6 p-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Profile</h2>
        <p className="text-gray-600">View your profile information</p>
      </div>

      <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden">
        <table className="w-full border-collapse">
          <tbody>
            {profileFields.map((field, index) => (
              <tr key={index}>
                {/* Left Column - Labels */}
                <td 
                  className="px-6 py-4 text-sm font-bold border-r border-gray-300"
                  style={{ 
                    backgroundColor: '#4f46e5',
                    color: '#ffffff',
                    width: '35%',
                    fontFamily: 'Times New Roman, Times, serif',
                    fontWeight: 'bold'
                  }}
                >
                  {field.label}
                </td>
                {/* Right Column - Values */}
                <td 
                  className="px-6 py-4 text-sm border-b border-gray-300"
                  style={{ 
                    backgroundColor: field.bgColor,
                    fontFamily: 'Times New Roman, Times, serif',
                    color: '#333333'
                  }}
                >
                  {field.isArray && Array.isArray(field.value) && field.value.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {field.value.map((app: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-medium"
                        >
                          {app}
                        </span>
                      ))}
                    </div>
                  ) : field.isArray ? (
                    <span className="text-gray-400 italic">Not mapped</span>
                  ) : (
                    field.value
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

