import React, { useEffect } from 'react';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import RequestList from './components/RequestList';
import RequestDetail from './components/RequestDetail';
import socketService from './services/socket';

function App() {
  useEffect(() => {
    // Connect to WebSocket server
    socketService.connect();

    // Cleanup on unmount
    return () => {
      socketService.disconnect();
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-dark-900 text-gray-200">
      <Header />
      <FilterBar />
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <RequestList />
        </div>
        <RequestDetail />
      </div>
    </div>
  );
}

export default App;
