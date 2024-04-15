import { useReducer, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useAuthenticator } from '@aws-amplify/ui-react';
import axios from 'axios';

import reactLogo from './assets/react.svg';

import viteLogo from '/vite.svg';
import './App.css';

function App() {
  const [count, addCount] = useReducer((prev) => prev + 1, 0);
  const [item, setItem] = useState();
  const [json, setJson] = useState();

  const { signOut, user } = useAuthenticator();

  const addItem = async () => {
    try {
      const session = await fetchAuthSession();
      const jwtToken = session.tokens?.idToken?.toString();

      const endpoint = `${import.meta.env.VITE_API_URL}/example/${count}`;
      const response = await axios.put(endpoint, null, {
        headers: {
          Authorization: jwtToken,
        },
      });
      setItem(response.data.description);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const getMetadata = async () => {
    try {
      const endpoint = `${import.meta.env.VITE_CLOUDFRONT_URL}/example.json`;
      const response = await axios.get(endpoint);
      setJson(response.data);
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
      <p>{`Hello, ${user.username}!`}</p>
      <div className="card">
        <button onClick={addCount}>count is {count}</button>
        <button onClick={addItem}>add item</button>
        <button onClick={getMetadata}>get metadata</button>
        {item && <p>{`${item} を追加しました!`}</p>}
        {json && <p>{JSON.stringify(json)}</p>}
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
        <button onClick={signOut}>SignOut</button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
