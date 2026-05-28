import { Header } from './components/Header';
import { ConsolePage } from './pages/ConsolePage';
import { StatusBar } from './components/StatusBar';

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Header />
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <ConsolePage />
      </main>
      <StatusBar />
    </div>
  );
}
