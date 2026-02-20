function Header() {
  return (
    <header className="p-4 bg-gray-800 text-white">
      <h1 className="text-xl font-bold">Notifications App</h1>
    </header>
  )
}

function App() {
  return (
    <div>
      <Header />
      <main className="p-8">
        <p className="text-gray-600">Notifications application placeholder.</p>
      </main>
    </div>
  )
}

export default App
