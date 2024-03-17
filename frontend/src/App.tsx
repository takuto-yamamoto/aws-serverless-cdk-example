import { useReducer, useState } from 'react';
import axios from 'axios';

import reactLogo from './assets/react.svg';

import viteLogo from '/vite.svg';
import './App.css';

function App() {
  const [count, addCount] = useReducer((prev) => prev + 1, 0);
  const [item, setItem] = useState(null);

  const addItem = async () => {
    try {
      const endpoint = `${import.meta.env.VITE_API_URL}/example/${count}`;
      const response = await axios.put(endpoint);
      setItem(response.data.description);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={addCount}>count is {count}</button>
        <button onClick={addItem}>add item</button>
        {item && <p>{`${item} を追加しました!`}</p>}
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
