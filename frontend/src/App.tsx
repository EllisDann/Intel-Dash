import { useEffect, useState } from 'react';

function App() {
  const [message, setMessage] = useState('Welcome to IntelBoard');

  useEffect(() => {
    document.title = 'IntelBoard';
  }, []);

  return (
    <div className="app-shell">
      <main>
        <h1>IntelBoard</h1>
        <p>{message}</p>
        <p>IntelBoard is the productivity analytics platform for engineering teams.</p>
      </main>
    </div>
  );
}

export default App;
