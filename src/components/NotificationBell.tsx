import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'system';
  category: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

interface NotificationBellProps {
  selectedApplication?: string;
}

export default function NotificationBell({ selectedApplication }: NotificationBellProps = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const previousUnreadCountRef = useRef(0);

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();

    // Poll for new notifications every 10 seconds to ensure badge updates quickly
    const interval = setInterval(() => {
      fetchUnreadCount();
      if (isOpen) {
        fetchNotifications();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isOpen, selectedApplication]);

  // Play sound when unread count increases
  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current) {
      // New notification received, play voice announcement
      try {
        if ('speechSynthesis' in window) {
          const speak = () => {
            // Use Web Speech API for voice announcement
            const utterance = new SpeechSynthesisUtterance('Notification has arrived, Please check');
            
            // Try to find a female voice
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) {
              const femaleVoice = voices.find(voice => 
                voice.name.toLowerCase().includes('female') || 
                voice.name.toLowerCase().includes('zira') ||
                voice.name.toLowerCase().includes('samantha') ||
                voice.name.toLowerCase().includes('susan') ||
                voice.name.toLowerCase().includes('karen')
              );
              
              if (femaleVoice) {
                utterance.voice = femaleVoice;
              } else {
                // Fallback to first available voice
                utterance.voice = voices[0];
              }
            }
            
            // Set voice properties
            utterance.rate = 1.0; // Normal speed
            utterance.pitch = 1.0; // Normal pitch
            utterance.volume = 1.0; // Full volume
            
            // Speak the notification
            speechSynthesis.speak(utterance);
          };
          
          // On Chrome, voices might not be loaded immediately
          if (speechSynthesis.getVoices().length > 0) {
            speak();
          } else {
            // Wait for voices to load
            speechSynthesis.onvoiceschanged = () => {
              speak();
              speechSynthesis.onvoiceschanged = null;
            };
          }
        }
      } catch (error) {
        console.error('Error playing notification sound:', error);
      }
    }
    // Update the previous count
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get selectedApplication from prop or localStorage
      const app = selectedApplication || localStorage.getItem('selectedApplication') || '';
      
      // Build query string with application filter - always include if available
      const queryParams = new URLSearchParams({ limit: '20' });
      if (app && app.trim() !== '') {
        queryParams.append('application', app);
        console.log('[NotificationBell] Fetching notifications for application:', app);
      } else {
        console.warn('[NotificationBell] No application specified, notifications may show from all applications');
      }

      const url = `http://localhost:5000/api/notifications?${queryParams.toString()}`;
      console.log('[NotificationBell] Fetching notifications from:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const fetchedNotifications = data.data.notifications || [];
        console.log(`[NotificationBell] Received ${fetchedNotifications.length} notifications for application: ${app}`);
        console.log('[NotificationBell] Notifications:', fetchedNotifications.map((n: Notification) => ({ 
          id: n._id, 
          title: n.title, 
          application: (n as any).application || 'NO APPLICATION FIELD' 
        })));
        setNotifications(fetchedNotifications);
      } else {
        console.error('[NotificationBell] Failed to fetch notifications:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get selectedApplication from prop or localStorage
      const app = selectedApplication || localStorage.getItem('selectedApplication') || '';
      
      // Build query string with application filter - always include if available
      const queryParams = new URLSearchParams();
      if (app && app.trim() !== '') {
        queryParams.append('application', app);
        console.log('[NotificationBell] Fetching unread count for application:', app);
      } else {
        console.warn('[NotificationBell] No application specified for unread count');
      }

      const url = queryParams.toString() 
        ? `http://localhost:5000/api/notifications/unread-count?${queryParams.toString()}`
        : 'http://localhost:5000/api/notifications/unread-count';

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const count = data.data?.unreadCount || data.unreadCount || 0;
        setUnreadCount(count);
      } else if (response.status === 404) {
        // Route not found - server might not have notification routes loaded yet
        console.warn('Notification API not available yet');
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch(`http://localhost:5000/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev =>
          prev.map(n =>
            n._id === notificationId ? { ...n, isRead: true } : n
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Get selectedApplication from prop or localStorage
      const app = selectedApplication || localStorage.getItem('selectedApplication') || '';

      const response = await fetch('http://localhost:5000/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          application: app || undefined
        })
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all your notifications? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please log in again to clear notifications.');
        return;
      }

      // Get selectedApplication from prop or localStorage
      const app = selectedApplication || localStorage.getItem('selectedApplication') || '';
      
      // Build query string with application filter if available
      const queryParams = new URLSearchParams();
      if (app) {
        queryParams.append('application', app);
      }

      const url = queryParams.toString()
        ? `http://localhost:5000/api/notifications/all?${queryParams.toString()}`
        : 'http://localhost:5000/api/notifications/all';

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const responseData = await response.json().catch(() => ({ error: 'Failed to parse response' }));

      if (response.ok && responseData.success) {
        console.log(`✅ Cleared ${responseData.data?.deletedCount || 0} notifications for current user`);
        setNotifications([]);
        setUnreadCount(0);
        // Refresh the notifications list to ensure UI is in sync
        fetchNotifications();
        fetchUnreadCount();
      } else {
        console.error('Failed to clear notifications. Status:', response.status, 'Response:', responseData);
        const errorMsg = responseData.error || responseData.message || `Server returned status ${response.status}`;
        alert(`Failed to clear notifications: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error clearing all notifications:', error);
      alert(`Error clearing notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await handleMarkAsRead(notification._id);
    }

    if (notification.link) {
      navigate(notification.link);
      setIsOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative z-50" ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Bell Icon Button */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (!isOpen) {
            if (buttonRef.current) {
              const rect = buttonRef.current.getBoundingClientRect();
              setDropdownPosition({
                top: Math.max(80, rect.bottom + 8),
                right: Math.max(16, window.innerWidth - rect.right)
              });
            } else {
              // Fallback position
              setDropdownPosition({ top: 80, right: 32 });
            }
            fetchNotifications();
          }
          setIsOpen(!isOpen);
        }}
        className="relative p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
        aria-label="Notifications"
        style={{ position: 'relative' }}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span 
            className="absolute flex items-center justify-center z-10 text-white font-bold shadow-lg"
            style={{ 
              backgroundColor: '#dc2626',
              color: '#ffffff',
              top: '0px',
              right: '0px',
              transform: 'translate(50%, -50%)',
              minWidth: unreadCount > 9 ? '22px' : '20px',
              height: unreadCount > 9 ? '22px' : '20px',
              borderRadius: '50%',
              padding: '0',
              fontSize: unreadCount > 9 ? '10px' : '11px',
              lineHeight: '1',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel - Using fixed positioning to avoid clipping */}
      {isOpen && (
        <div 
          className="fixed w-96 bg-white rounded-lg shadow-2xl border border-gray-200 z-[9999]"
          style={{ 
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            maxHeight: `calc(100vh - ${dropdownPosition.top + 20}px)`,
            minHeight: '400px',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-white">
            <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
            <div className="flex items-center gap-6">
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                  title="Clear all notifications"
                >
                  Clear all
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  title="Mark all as read"
                >
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* Notifications List - Scrollable Area */}
          <div 
            className="overflow-y-auto overflow-x-hidden"
            style={{ 
              flex: '1 1 auto',
              minHeight: '300px',
              maxHeight: '500px'
            }}
          >
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500" style={{ minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                <svg
                  className="w-16 h-16 mx-auto text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p className="text-base font-medium">No notifications</p>
                <p className="text-sm text-gray-400 mt-2">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <button
                    key={notification._id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-sm font-medium ${
                              !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                            }`}
                          >
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full ml-2"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 text-center flex-shrink-0">
              <button
                onClick={() => {
                  // Could navigate to a full notifications page
                  setIsOpen(false);
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

